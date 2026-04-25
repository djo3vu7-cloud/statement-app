from http.server import BaseHTTPRequestHandler
import json, base64, io, re

def parse_hsbc(pdf_bytes):
    import pdfplumber

    year = None
    billing_date = None
    billing_month = None
    raw_transactions = []
    fee_rows = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        full_text = "\n".join(p.extract_text() or "" for p in pdf.pages)

        # 取得年份與帳單結帳日
        m = re.search(r'帳單結帳日\s+(\d{4})/(\d{2})/(\d{2})', full_text)
        if m:
            year = m.group(1)
            billing_date = f"{m.group(1)}/{m.group(2)}/{m.group(3)}"
            billing_month = f"{m.group(1)}-{m.group(2)}"

        if not year:
            m2 = re.search(r'(\d{4})/\d{2}/\d{2}', full_text)
            year = m2.group(1) if m2 else "2026"

        # 跳過段落標題
        SKIP_PATTERNS = [
            r'^上期應繳總額', r'^付（退）款', r'^前期餘額',
            r'^消費／新增', r'^本期應繳', r'^小計',
            r'^\d{2}/\d{2}\s+\d{2}/\d{2}\s+全國繳費網',
        ]

        # 從每頁萃取表格列
        for page in pdf.pages:
            table = page.extract_table({
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
            })
            if not table:
                # 備用：用文字行解析
                text = page.extract_text() or ""
                for line in text.split("\n"):
                    _process_line(line.strip(), year, raw_transactions, fee_rows)
                continue

            for row in table:
                if not row:
                    continue
                # 合併欄位為一行處理
                line = " ".join(c.strip() for c in row if c and c.strip())
                _process_line(line, year, raw_transactions, fee_rows)

    # 比對手續費到對應主交易
    for fee in fee_rows:
        # 手續費描述格式：國外交易手續費XXXXXXX
        fee_partial = fee["partial_desc"].upper()
        matched = False
        for tx in raw_transactions:
            if tx.get("currency") and tx["currency"] != "TWD":
                desc_upper = tx["description"].upper().replace(" ", "").replace("*", "")
                partial_clean = fee_partial.replace(" ", "").replace("*", "")
                if (fee["charge_date"] == tx["charge_date"] and
                        (partial_clean in desc_upper or desc_upper[:len(partial_clean)] == partial_clean[:len(desc_upper)])):
                    tx["fee"] = -abs(fee["amount"])
                    matched = True
                    break
        if not matched:
            # 嘗試寬鬆匹配（同日期前10字元）
            for tx in raw_transactions:
                if tx.get("currency") and tx["currency"] != "TWD":
                    if fee["charge_date"] == tx["charge_date"] and not tx.get("fee"):
                        tx["fee"] = -abs(fee["amount"])
                        break

    # 計算匯率
    for tx in raw_transactions:
        if tx.get("currency") and tx["currency"] != "TWD" and tx.get("foreign_amount"):
            fa = tx["foreign_amount"]
            twd = abs(tx["amount_twd"])
            tx["exchange_rate"] = round(twd / fa, 4) if fa else 1.0
        else:
            tx["exchange_rate"] = 1.0

    return {
        "billing_month": billing_month or year + "-??",
        "billing_date": billing_date,
        "transactions": raw_transactions,
    }


# 日期正則
RE_DATE = r'(\d{2}/\d{2})'
# 金額正則（含負號和逗號）
RE_AMOUNT = r'-?([\d,]+)'
# 外幣資訊：XXX YYY 1,234.00
RE_FOREIGN = r'([A-Z]{3})\s+([A-Z]{3})\s+([\d,]+\.?\d*)'


def _process_line(line, year, raw_transactions, fee_rows):
    if not line:
        return

    SKIP_KEYWORDS = [
        '上期應繳', '付（退）款', '前期餘額', '消費／新增',
        '本期應繳', '小計', '帳單結帳', '繳款截止', '信用額度',
        '滙豐旅遊', '上月結餘', '本月新增', '循環利率',
        '簽帳日期', '交易說明',
    ]
    for kw in SKIP_KEYWORDS:
        if kw in line:
            return

    # 必須以日期開頭
    m = re.match(rf'^{RE_DATE}\s+{RE_DATE}\s+(.+)', line)
    if not m:
        return

    charge_date_raw = m.group(1)   # MM/DD
    post_date_raw = m.group(2)     # MM/DD
    rest = m.group(3).strip()

    charge_month = int(charge_date_raw.split("/")[0])
    post_month = int(post_date_raw.split("/")[0])
    charge_year = year
    post_year = year
    # 跨年處理（12月簽帳1月入帳）
    if charge_month == 12 and post_month == 1:
        post_year = str(int(year) + 1)
    elif charge_month == 1 and post_month == 12:
        charge_year = str(int(year) - 1)

    charge_date = f"{charge_year}-{charge_date_raw.replace('/', '-')}"
    post_date = f"{post_year}-{post_date_raw.replace('/', '-')}"

    # 手續費行
    if rest.startswith("國外交易手續費"):
        partial = rest[len("國外交易手續費"):].strip()
        # 最後一段是金額
        parts = rest.rsplit(None, 1)
        if len(parts) == 2 and re.match(r'^[\d,]+$', parts[1].replace(",", "")):
            amt = int(parts[1].replace(",", ""))
            fee_rows.append({
                "charge_date": charge_date,
                "partial_desc": partial.rsplit(None, 1)[0] if " " in partial else partial,
                "amount": amt,
            })
        return

    # 嘗試解析外幣資訊
    foreign_match = re.search(RE_FOREIGN, rest)
    currency = None
    foreign_amount = None
    exchange_date = None

    if foreign_match:
        # country_code = foreign_match.group(1)  (e.g. JPN)
        currency = foreign_match.group(2)          # e.g. JPY
        foreign_amount = float(foreign_match.group(3).replace(",", ""))
        rest_after = rest[foreign_match.end():].strip()

        # 後面可能有 折算日期 + TWD金額
        m2 = re.match(rf'^{RE_DATE}\s+({RE_AMOUNT})$', rest_after)
        if m2:
            exchange_date = f"{year}-{m2.group(1).replace('/', '-')}"
            amount_twd = int(m2.group(2).replace(",", ""))
            description = rest[:foreign_match.start()].strip()
        else:
            # 嘗試只有金額
            m3 = re.search(r'([\d,]+)\s*$', rest_after)
            amount_twd = int(m3.group(1).replace(",", "")) if m3 else 0
            description = rest[:foreign_match.start()].strip()

        if currency == "TWD":
            # 雖然在日本但用台幣結算
            currency = None
            foreign_amount = None
    else:
        # 國內交易：描述 + 金額
        m4 = re.match(r'^(.+?)\s+([\d,]+)\s*$', rest)
        if not m4:
            return
        description = m4.group(1).strip()
        amount_twd = int(m4.group(2).replace(",", ""))

    if amount_twd == 0:
        return

    raw_transactions.append({
        "id": f"{charge_date}-{len(raw_transactions)}",
        "charge_date": charge_date,
        "post_date": post_date,
        "exchange_date": exchange_date,
        "description": description,
        "amount_twd": -amount_twd,   # 支出為負
        "currency": currency,
        "foreign_amount": foreign_amount,
        "fee": None,
        "exchange_rate": None,
        "category_1": "",
        "category_2": "",
    })


def auto_categorize(transactions, rules):
    """根據關鍵字規則自動分類"""
    # rules: [{keyword, category_1, category_2, priority}]
    rules_sorted = sorted(rules, key=lambda r: -r.get("priority", 0))
    for tx in transactions:
        desc = tx["description"].upper()
        for rule in rules_sorted:
            if rule["keyword"].upper() in desc:
                tx["category_1"] = rule["category_1"]
                tx["category_2"] = rule.get("category_2", "")
                break
    return transactions


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length)
            body = json.loads(raw)

            pdf_bytes = base64.b64decode(body["pdf_base64"])
            rules = body.get("rules", [])

            result = parse_hsbc(pdf_bytes)
            result["transactions"] = auto_categorize(result["transactions"], rules)

            self._respond(200, result)
        except Exception as e:
            import traceback
            self._respond(200, {"error": str(e), "detail": traceback.format_exc()})

    def _respond(self, code, data):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, *args):
        pass
