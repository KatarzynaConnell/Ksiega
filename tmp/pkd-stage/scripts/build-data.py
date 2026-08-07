"""Buduje lokalny zestaw PKD 2025 z oficjalnego PDF GUS."""

import json
import re
import sys
import tempfile
import urllib.request
from pathlib import Path

import pdfplumber


SOURCE_URL = "https://klasyfikacje.stat.gov.pl/static/pkd_25/pdf/KlasyfikacjaPKD2025.pdf"
EXPECTED_RECORDS = 728
EXPECTED_SECTIONS = set("ABCDEFGHIJKLMNOPQRSTUV")
CODE_PATTERN = re.compile(r"\d{2}\.\d{2}\.[A-Z]")
SECTION_PATTERN = re.compile(r"SEKC\s*JA\s+([A-V])\b", re.IGNORECASE)
TABLE_SETTINGS = {
    "vertical_strategy": "explicit",
    "explicit_vertical_lines": [71.1, 108.62, 153.4, 197.45, 254.93, 524.23],
    "horizontal_strategy": "lines",
    "snap_tolerance": 3,
    "intersection_tolerance": 5,
}


def clean(value):
    return re.sub(r"\s+", " ", value or "").strip()


def extract_records(pdf_path):
    records = []
    section = None

    with pdfplumber.open(pdf_path) as pdf:
        # Wykaz struktury klasyfikacji znajduje się na stronach PDF 38–72.
        for page in pdf.pages[37:72]:
            table = page.extract_table(TABLE_SETTINGS) or []
            for row in table:
                cells = [clean(cell) for cell in row]
                section_match = SECTION_PATTERN.search(" ".join(cells))
                if section_match:
                    section = section_match.group(1).upper()

                if len(cells) < 5 or not CODE_PATTERN.fullmatch(cells[3]):
                    continue
                if section is None:
                    raise RuntimeError(f"Kod {cells[3]} nie ma przypisanej sekcji")

                code = cells[3]
                records.append({
                    "section": section,
                    "division": code[:2],
                    "group": code[:4],
                    "classCode": code[:5],
                    "code": code,
                    "description": cells[4],
                })

    return records


def validate(records):
    codes = [record["code"] for record in records]
    if len(records) != EXPECTED_RECORDS:
        raise RuntimeError(f"Oczekiwano {EXPECTED_RECORDS} kodów, odczytano {len(records)}")
    if len(codes) != len(set(codes)):
        raise RuntimeError("W danych występują zduplikowane kody PKD")
    if {record["section"] for record in records} != EXPECTED_SECTIONS:
        raise RuntimeError("Zestaw nie zawiera wszystkich sekcji A–V")
    if any(not record["description"] for record in records):
        raise RuntimeError("Co najmniej jeden kod nie ma opisu")


def write_data(records, output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(records, ensure_ascii=False, indent=2)
    output_path.write_text(
        "// Oficjalna klasyfikacja GUS PKD 2025 — 728 podklas.\n"
        f"// Źródło: {SOURCE_URL}\n"
        f"window.PKD_DATA = {payload};\n",
        encoding="utf-8",
    )


def main():
    project_dir = Path(__file__).resolve().parents[1]
    output_path = project_dir / "data" / "pkd-data.js"

    if len(sys.argv) > 1:
        pdf_path = Path(sys.argv[1]).resolve()
        print(f"Odczytywanie lokalnego pliku {pdf_path}…")
        records = extract_records(pdf_path)
    else:
        with tempfile.TemporaryDirectory(prefix="pkd-gus-") as temp_dir:
            pdf_path = Path(temp_dir) / "KlasyfikacjaPKD2025.pdf"
            print("Pobieranie oficjalnej klasyfikacji GUS PKD 2025…")
            urllib.request.urlretrieve(SOURCE_URL, pdf_path)
            records = extract_records(pdf_path)

    validate(records)
    write_data(records, output_path)
    print(f"Zapisano {len(records)} unikalnych kodów w {output_path}")


if __name__ == "__main__":
    main()
