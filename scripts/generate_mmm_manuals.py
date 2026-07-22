#!/usr/bin/env python3
"""Generate the Korean and English MMM model manuals shipped with the app.

The manuals intentionally describe the browser-side implementation, including
its limits. They must not be rewritten as generic Bayesian MMM brochures: the
Meridian comparison and the statements about analytical inference, profile
model averaging, and validation are part of the product's trust contract.
"""

from __future__ import annotations

import argparse
import os
import shutil
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    ListFlowable,
    ListItem,
    LongTable,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


PAGE_W, PAGE_H = A4
MODEL_VERSION = "1.1.0"
NAVY = colors.HexColor("#111827")
INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#5C667A")
PURPLE = colors.HexColor("#7C5CFC")
CYAN = colors.HexColor("#22D3EE")
TEAL = colors.HexColor("#0F9D83")
AMBER = colors.HexColor("#D97706")
RED = colors.HexColor("#C2415B")
PAPER = colors.HexColor("#F7F8FC")
LINE = colors.HexColor("#DDE2EC")
PALE_PURPLE = colors.HexColor("#F0EDFF")
PALE_TEAL = colors.HexColor("#EAF8F4")
PALE_AMBER = colors.HexColor("#FFF6E5")
PALE_RED = colors.HexColor("#FDEEF2")

FONT_CANDIDATES = [
    Path("/System/Library/Fonts/Supplemental/AppleGothic.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
]


def register_fonts() -> str:
    font_path = next((path for path in FONT_CANDIDATES if path.exists()), None)
    if not font_path:
        raise FileNotFoundError(
            "A Korean-capable font was not found. Expected AppleGothic.ttf or Arial Unicode.ttf."
        )
    pdfmetrics.registerFont(TTFont("ManualSans", str(font_path)))
    # AppleGothic ships as a single face. Registering it under a second family
    # name lets styles stay explicit and portable without fake missing glyphs.
    pdfmetrics.registerFont(TTFont("ManualSansBold", str(font_path)))
    return str(font_path)


def build_styles() -> dict[str, ParagraphStyle]:
    sample = getSampleStyleSheet()
    return {
        "CoverKicker": ParagraphStyle(
            "CoverKicker",
            parent=sample["Normal"],
            fontName="ManualSansBold",
            fontSize=10,
            leading=15,
            textColor=CYAN,
            tracking=1.2,
            spaceAfter=9 * mm,
        ),
        "CoverTitle": ParagraphStyle(
            "CoverTitle",
            parent=sample["Title"],
            fontName="ManualSansBold",
            fontSize=31,
            leading=41,
            textColor=colors.white,
            alignment=TA_LEFT,
            spaceAfter=7 * mm,
        ),
        "CoverSub": ParagraphStyle(
            "CoverSub",
            parent=sample["Normal"],
            fontName="ManualSans",
            fontSize=13,
            leading=21,
            textColor=colors.HexColor("#CBD5E1"),
            spaceAfter=6 * mm,
        ),
        "CoverMeta": ParagraphStyle(
            "CoverMeta",
            parent=sample["Normal"],
            fontName="ManualSans",
            fontSize=9.2,
            leading=15,
            textColor=colors.HexColor("#AAB4C6"),
        ),
        "Title": ParagraphStyle(
            "Title",
            parent=sample["Title"],
            fontName="ManualSansBold",
            fontSize=24,
            leading=31,
            textColor=NAVY,
            alignment=TA_LEFT,
            spaceAfter=7 * mm,
        ),
        "Heading1": ParagraphStyle(
            "Heading1",
            parent=sample["Heading1"],
            fontName="ManualSansBold",
            fontSize=19,
            leading=25,
            textColor=NAVY,
            spaceBefore=1 * mm,
            spaceAfter=5 * mm,
            keepWithNext=True,
        ),
        "Heading2": ParagraphStyle(
            "Heading2",
            parent=sample["Heading2"],
            fontName="ManualSansBold",
            fontSize=13.2,
            leading=18,
            textColor=PURPLE,
            spaceBefore=5 * mm,
            spaceAfter=2.8 * mm,
            keepWithNext=True,
        ),
        "Heading3": ParagraphStyle(
            "Heading3",
            parent=sample["Heading3"],
            fontName="ManualSansBold",
            fontSize=10.6,
            leading=15,
            textColor=INK,
            spaceBefore=3.2 * mm,
            spaceAfter=1.5 * mm,
            keepWithNext=True,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=sample["BodyText"],
            fontName="ManualSans",
            fontSize=9.25,
            leading=15.2,
            textColor=INK,
            wordWrap="CJK",
            spaceAfter=2.8 * mm,
        ),
        "Small": ParagraphStyle(
            "Small",
            parent=sample["BodyText"],
            fontName="ManualSans",
            fontSize=7.7,
            leading=11.5,
            textColor=MUTED,
            wordWrap="CJK",
            spaceAfter=1.6 * mm,
        ),
        "TableHead": ParagraphStyle(
            "TableHead",
            parent=sample["BodyText"],
            fontName="ManualSansBold",
            fontSize=7.6,
            leading=10.5,
            textColor=colors.white,
            wordWrap="CJK",
        ),
        "TableCell": ParagraphStyle(
            "TableCell",
            parent=sample["BodyText"],
            fontName="ManualSans",
            fontSize=7.3,
            leading=10.8,
            textColor=INK,
            wordWrap="CJK",
        ),
        "TableCellStrong": ParagraphStyle(
            "TableCellStrong",
            parent=sample["BodyText"],
            fontName="ManualSansBold",
            fontSize=7.3,
            leading=10.8,
            textColor=INK,
            wordWrap="CJK",
        ),
        "Formula": ParagraphStyle(
            "Formula",
            parent=sample["BodyText"],
            fontName="Courier",
            fontSize=8.1,
            leading=12.2,
            textColor=NAVY,
            leftIndent=4 * mm,
            rightIndent=4 * mm,
            spaceBefore=1.5 * mm,
            spaceAfter=2.8 * mm,
        ),
        "Callout": ParagraphStyle(
            "Callout",
            parent=sample["BodyText"],
            fontName="ManualSans",
            fontSize=8.6,
            leading=13.5,
            textColor=INK,
            wordWrap="CJK",
        ),
        "TOCHeading": ParagraphStyle(
            "TOCHeading",
            parent=sample["Heading1"],
            fontName="ManualSansBold",
            fontSize=22,
            leading=28,
            textColor=NAVY,
            spaceAfter=8 * mm,
        ),
        "TOC1": ParagraphStyle(
            "TOC1",
            parent=sample["Normal"],
            fontName="ManualSansBold",
            fontSize=9.2,
            leading=15,
            leftIndent=0,
            firstLineIndent=0,
            textColor=INK,
        ),
        "TOC2": ParagraphStyle(
            "TOC2",
            parent=sample["Normal"],
            fontName="ManualSans",
            fontSize=7.8,
            leading=12,
            leftIndent=6 * mm,
            firstLineIndent=0,
            textColor=MUTED,
        ),
    }


class ManualDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str, locale: str, styles: dict[str, ParagraphStyle]):
        self.locale = locale
        self.styles = styles
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=18 * mm,
            rightMargin=18 * mm,
            topMargin=19 * mm,
            bottomMargin=18 * mm,
            title="MMM Model Manual" if locale == "en" else "MMM 모델 설명서",
            author="Performance Marketing Library",
            subject="Browser-side MMM methodology, inputs, priors, validation, and interpretation",
            creator="Performance Marketing Library",
        )
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="manual-frame",
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates([PageTemplate(id="manual", frames=[frame], onPage=self._draw_page)])

    def _draw_page(self, canvas, doc):
        canvas.saveState()
        if doc.page == 1:
            canvas.setFillColor(NAVY)
            canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
            canvas.setFillColor(PURPLE)
            canvas.rect(0, 0, 9 * mm, PAGE_H, fill=1, stroke=0)
            canvas.setFillColor(colors.HexColor("#1F2A44"))
            canvas.circle(PAGE_W - 25 * mm, PAGE_H - 27 * mm, 35 * mm, fill=1, stroke=0)
            canvas.setFillColor(colors.HexColor("#182238"))
            canvas.circle(PAGE_W - 10 * mm, 29 * mm, 48 * mm, fill=1, stroke=0)
        else:
            canvas.setStrokeColor(LINE)
            canvas.setLineWidth(0.4)
            canvas.line(18 * mm, PAGE_H - 13 * mm, PAGE_W - 18 * mm, PAGE_H - 13 * mm)
            canvas.setFont("ManualSansBold", 7.3)
            canvas.setFillColor(MUTED)
            header = "MMM MODEL MANUAL" if self.locale == "en" else "MMM 모델 설명서"
            canvas.drawString(18 * mm, PAGE_H - 10 * mm, header)
            canvas.setFont("ManualSans", 6.9)
            privacy = (
                "Client-side analysis / User CSV is not transmitted"
                if self.locale == "en"
                else "클라이언트 분석 / 사용자 CSV는 서버로 전송되지 않음"
            )
            canvas.drawRightString(PAGE_W - 18 * mm, PAGE_H - 10 * mm, privacy)
            canvas.line(18 * mm, 12 * mm, PAGE_W - 18 * mm, 12 * mm)
            canvas.setFont("ManualSans", 7)
            canvas.drawString(18 * mm, 8.2 * mm, "Performance Marketing Library")
            canvas.setFont("Helvetica", 7)
            canvas.drawRightString(PAGE_W - 18 * mm, 8.2 * mm, str(doc.page))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph):
            return
        style_name = flowable.style.name
        if style_name not in {"Heading1", "Heading2"}:
            return
        level = 0 if style_name == "Heading1" else 1
        text = flowable.getPlainText()
        key = f"section-{self.page}-{abs(hash((text, self.page))) % 10_000_000}"
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text, key, level=level, closed=False)
        self.notify("TOCEntry", (level, text, self.page, key))


def plain(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(str(text)).replace("\n", "<br/>"), style)


def rich(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text, style)


def heading(text: str, level: int, styles: dict[str, ParagraphStyle]) -> Paragraph:
    return plain(text, styles[f"Heading{level}"])


def body(text: str, styles: dict[str, ParagraphStyle]) -> Paragraph:
    return plain(text, styles["Body"])


def small(text: str, styles: dict[str, ParagraphStyle]) -> Paragraph:
    return plain(text, styles["Small"])


def bullets(items: list[str], styles: dict[str, ParagraphStyle], numbered: bool = False):
    options = {
        "bulletType": "1" if numbered else "bullet",
        "leftIndent": 6 * mm,
        "bulletFontName": "ManualSans",
        "bulletFontSize": 7.5,
        "bulletColor": PURPLE,
        "spaceAfter": 2.5 * mm,
    }
    if numbered:
        options["start"] = "1"
    return ListFlowable(
        [ListItem(plain(item, styles["Body"]), leftIndent=4 * mm) for item in items],
        **options,
    )


def formula(lines: list[str] | str, styles: dict[str, ParagraphStyle]) -> Table:
    if isinstance(lines, str):
        lines = [lines]
    block = "<br/>".join(escape(line) for line in lines)
    table = Table([[Paragraph(block, styles["Formula"])]], colWidths=[174 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F3F5FA")),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("LINEBEFORE", (0, 0), (0, -1), 2.5, PURPLE),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1 * mm),
            ]
        )
    )
    return table


def callout(
    title: str,
    text: str,
    styles: dict[str, ParagraphStyle],
    tone: str = "purple",
) -> Table:
    palette = {
        "purple": (PURPLE, PALE_PURPLE),
        "teal": (TEAL, PALE_TEAL),
        "amber": (AMBER, PALE_AMBER),
        "red": (RED, PALE_RED),
    }
    accent, bg = palette[tone]
    content = rich(
        f'<font name="ManualSansBold" color="{accent.hexval()}">{escape(title)}</font><br/>{escape(text)}',
        styles["Callout"],
    )
    box = Table([[content]], colWidths=[174 * mm])
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("BOX", (0, 0), (-1, -1), 0.5, accent),
                ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    return KeepTogether([box, Spacer(1, 3 * mm)])


def data_table(
    headers: list[str],
    rows: list[list[str]],
    widths: list[float],
    styles: dict[str, ParagraphStyle],
    first_col_strong: bool = True,
) -> LongTable:
    wrapped = [[plain(cell, styles["TableHead"]) for cell in headers]]
    for row in rows:
        wrapped.append(
            [
                plain(
                    cell,
                    styles["TableCellStrong"] if first_col_strong and index == 0 else styles["TableCell"],
                )
                for index, cell in enumerate(row)
            ]
        )
    table = LongTable(wrapped, colWidths=[width * mm for width in widths], repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]),
                ("LEFTPADDING", (0, 0), (-1, -1), 2.2 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2.2 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
            ]
        )
    )
    return table


def source_item(title: str, url: str, styles: dict[str, ParagraphStyle]) -> Paragraph:
    return rich(
        f'<link href="{escape(url)}" color="{PURPLE.hexval()}"><u>{escape(title)}</u></link>'
        f'<br/><font size="7" color="{MUTED.hexval()}">{escape(url)}</font>',
        styles["Body"],
    )


def chapter(story: list, title: str, styles: dict[str, ParagraphStyle], first: bool = False):
    if not first:
        story.append(PageBreak())
    story.append(heading(title, 1, styles))


def cover_and_toc(locale: str, styles: dict[str, ParagraphStyle]) -> list:
    is_en = locale == "en"
    today = date.today().isoformat()
    story = [Spacer(1, 36 * mm)]
    story.append(
        plain(
            "PERFORMANCE MARKETING LIBRARY / MODEL HANDBOOK"
            if is_en
            else "PERFORMANCE MARKETING LIBRARY / MODEL HANDBOOK",
            styles["CoverKicker"],
        )
    )
    story.append(
        plain(
            "MMM Model Manual\nInputs, methodology, priors, validation, and interpretation"
            if is_en
            else "MMM 모델 설명서\n입력 데이터부터 사전정보, 검증, 해석까지",
            styles["CoverTitle"],
        )
    )
    story.append(
        plain(
            "A practical and technical reference for the browser-side empirical-Bayes MMM. It explains what the model calculates, where uncertainty comes from, how experimental and country evidence is transferred, and where the result must not be interpreted causally."
            if is_en
            else "브라우저 안에서 동작하는 empirical-Bayes MMM의 실무·기술 참고서입니다. 모델이 무엇을 계산하는지, 불확실성이 어디서 오는지, 실험과 유사 국가 근거가 어떻게 전달되는지, 어디까지 인과적으로 해석하면 안 되는지를 설명합니다.",
            styles["CoverSub"],
        )
    )
    story.append(Spacer(1, 27 * mm))
    story.append(
        plain(
            (f"Edition 1.0 / {today}\nMMM methodology {MODEL_VERSION} / Korean and English parity edition\n"
             "Processing policy: uploaded CSV data stays in browser memory and is not sent to a server.")
            if is_en
            else (f"Edition 1.0 / {today}\nMMM methodology {MODEL_VERSION} / 한국어·영어 동등 기능판\n"
                  "처리 원칙: 업로드한 CSV는 브라우저 메모리에서만 처리되며 서버로 전송되지 않습니다."),
            styles["CoverMeta"],
        )
    )
    story.append(PageBreak())
    story.append(plain("Contents" if is_en else "목차", styles["TOCHeading"]))
    toc = TableOfContents()
    toc.levelStyles = [styles["TOC1"], styles["TOC2"]]
    toc.dotsMinLevel = 0
    story.append(toc)
    story.append(Spacer(1, 5 * mm))
    story.append(
        callout(
            "How to use this manual" if is_en else "이 설명서 읽는 법",
            (
                "Operators can start with Chapters 1-4 and 10-12. Analysts and reviewers should also read Chapters 5-9 and 14-15. The final checklists are designed for presentation approval."
                if is_en
                else "운영자는 1~4장과 10~12장부터, 분석·검토 담당자는 5~9장과 14~15장까지 읽으세요. 마지막 체크리스트는 대외 발표 전 승인 절차에 바로 쓸 수 있습니다."
            ),
            styles,
            "purple",
        )
    )
    return story


def korean_story(styles: dict[str, ParagraphStyle]) -> list:
    s = cover_and_toc("ko", styles)

    chapter(s, "1. 이 모델이 하는 일과 하지 않는 일", styles)
    s += [
        heading("1.1 한 문장 정의", 2, styles),
        body(
            "이 앱의 MMM은 주간 성과 변동을 자연수요·추세·계절·이벤트·매체 기여로 나누고, 광고의 잔효와 포화를 고려해 채널별 효과의 방향·범위·반응곡선을 추정하는 클라이언트 사이드 분석 모델입니다.",
            styles,
        ),
        callout(
            "핵심 결론",
            "이 모델은 Meridian의 아이디어를 일부 차용했지만 Meridian 자체가 아닙니다. NUTS/MCMC를 돌리는 완전 계층형 모델이 아니라, 잔차분산을 plug-in 추정하고 정규 prior와 약한 ridge 정규화를 결합한 empirical-Bayes 조건부 Gaussian 근사입니다.",
            styles,
            "teal",
        ),
        heading("1.2 답할 수 있는 질문", 2, styles),
        bullets(
            [
                "같은 기간에 어떤 채널이 KPI 변동과 양의 관계를 보였는가? 효과의 양수 확률과 90% 구간은 얼마나 안정적인가?",
                "현재 집행 수준이 반응곡선의 어느 위치에 있으며, 추가 예산의 한계효과가 얼마나 남았는가?",
                "실험 또는 유사 국가 근거를 반영했을 때 결론이 얼마나 바뀌며, 각 근거의 전용 검증은 통과하는가?",
                "추세·계절·이벤트를 분리한 뒤 주차별 성과를 어떤 요인이 설명했는가?",
                "다섯 KPI 중 동일한 매체 입력에 대해 목표만 바꿨을 때 결론이 어떻게 달라지는가?",
            ],
            styles,
        ),
        heading("1.3 답하면 안 되는 질문", 2, styles),
        bullets(
            [
                "관측 데이터만으로 특정 채널의 순수 증분효과를 확정하는 것. 강한 공선성이나 동시 집행이 있으면 식별이 불가능할 수 있습니다.",
                "양수 확률이 낮다는 이유만으로 효과가 0이라고 단정하는 것. 이는 효과 없음이 아니라 증거 부족일 수 있습니다.",
                "반응곡선 추천을 계약·재고·입찰 변화가 없는 확정 예산안으로 사용하는 것.",
                "다른 정의·통화·전환창을 쓰는 국가의 계수를 이름만 같다는 이유로 그대로 이전하는 것.",
                "모델 적합도 R2가 높다는 이유로 인과적으로 정확하다고 판단하는 것.",
            ],
            styles,
        ),
        heading("1.4 결과 사용 등급", 2, styles),
        data_table(
            ["등급", "사용 조건", "허용되는 의사결정", "필수 문구"],
            [
                ["탐색", "관측 데이터만, 식별 경고 존재", "추가 실험 우선순위·데이터 개선", "연관 기반 잠정 결론"],
                ["근거 보정", "실험/국가 prior 적용, 근거별 진단 통과", "범위형 예산 시나리오·채널 비교", "prior 가정과 검증 결과 공개"],
                ["의사결정 보조", "실험과 MMM 방향 일치, base OOS·건강지표 양호", "점진적 예산 변경과 후속 측정", "인과 확정이 아닌 보조 근거"],
            ],
            [24, 48, 55, 47],
            styles,
        ),
    ]

    chapter(s, "2. 빠른 시작: 분석 전부터 발표까지", styles)
    s += [
        heading("2.1 10단계 워크플로", 2, styles),
        bullets(
            [
                "날짜, 채널 spend, KPI, 0/1 이벤트·구조변화 열을 같은 CSV에 준비합니다.",
                "일별 파일을 그대로 업로드합니다. 앱이 월요일 시작 주차로 묶습니다.",
                "총유입·가입·재유입·매출·구매자 중 보유한 KPI를 매핑합니다.",
                "광고 열은 Performance 또는 Brand로 분류하고 0/1 이벤트·구조변화 열을 확인합니다.",
                "분석하기를 눌러 기본 모델을 먼저 실행합니다.",
                "예측 정확도, 구간 커버리지, 잔차 자기상관, 음수 자연수요를 확인합니다.",
                "실험 데이터가 있으면 Auto 판별 또는 사용자가 강제 선택한 On/Off·Geo 유형으로 prior를 생성합니다.",
                "참고 국가 데이터가 있으면 후보 국가와 추천 조합의 12주 반복 검증을 확인합니다.",
                "결론 화면에서 prior 적용/제거를 전환해 민감도를 비교합니다.",
                "대외 발표에는 데이터 범위·모델 버전·prior 출처·검증·한계를 함께 적습니다.",
            ],
            styles,
            numbered=True,
        ),
        heading("2.2 최소 데이터량", 2, styles),
        data_table(
            ["상태", "권장 주수", "판단"],
            [
                ["실무 권장", "104주 이상", "2년 계절·집행 변동과 반복 검증에 가장 유리"],
                ["분석 가능", "52~103주", "모델은 실행하되 예산 액션은 식별 게이트를 통과해야 함"],
                ["앱 low-info", "52주 미만", "효과 탐색은 가능해도 예산 추천을 차단"],
                ["매우 짧음", "24주 미만", "시계열 분해·포화·홀드아웃을 함께 식별하기 어려움"],
            ],
            [35, 42, 97],
            styles,
        ),
        callout(
            "더 많은 행이 항상 더 좋은 것은 아님",
            "같은 예산 패턴이 오래 반복된 데이터보다, 채널별 증감 시점이 구분되고 지원되는 0/1 이벤트·구조변화가 잘 기록된 데이터가 식별에 더 유리합니다.",
            styles,
            "amber",
        ),
        heading("2.3 실행 전 60초 점검", 2, styles),
        bullets(
            [
                "KPI는 주차별 합산 가능한 숫자인가? 누적값·비율·코호트 D7 같은 창 지표를 캘린더 주차 KPI와 섞지 않았는가?",
                "spend와 KPI의 국가·통화·시간대·전환창이 일치하는가?",
                "채널명이 분석 파일·실험 prior·국가 prior에서 정확히 같은가?",
                "프로모션·장애·명절처럼 앱이 지원하는 요인은 정확한 0/1 이벤트 또는 구조변화 step으로 기록했는가? 연속형 가격·경쟁 변수는 직접 매핑되지 않는 한계도 공개했는가?",
                "채널이 항상 같이 켜지고 꺼지는 완전 공선 패턴은 없는가?",
            ],
            styles,
        ),
    ]

    chapter(s, "3. MMM CSV 입력 규격", styles)
    s += [
        heading("3.1 한 행의 의미", 2, styles),
        body(
            "한 행은 일자 또는 주차입니다. 날짜가 일별이면 앱이 월요일을 시작으로 하는 주차로 자동 집계합니다. 이미 주차별 파일이라면 주차 식별 열을 그대로 사용합니다. 시간 열이 전혀 없으면 '이미 주별 1행이며 오래된 주→최신 주로 정렬됨'을 사용자가 명시적으로 확인해야 행 순서 t를 쓸 수 있습니다. 같은 파일 안에서 일별·주별 행을 섞지 마세요.",
            styles,
        ),
        heading("3.2 필드 사전", 2, styles),
        data_table(
            ["역할", "예시 헤더", "필수", "집계", "주의"],
            [
                ["날짜/주차", "date 또는 week", "둘 중 1개 또는 행순서 확인", "일자는 월요일 주차로 변환", "ISO 날짜/ISO week 권장"],
                ["국가", "country", "기본 선택 / 국가 prior 필수", "국가별 분리", "타깃은 정확히 1개 코드"],
                ["플랫폼/세그먼트", "platform", "선택", "값별 분리 또는 Total 합산", "Android/iOS 정의 고정"],
                ["매체비", "meta_spend, search_spend", "1개 이상", "주간 합계", "음수 금지, 통화 일치"],
                ["총유입", "traffic, sessions", "Y 선택", "주간 합계", "가입+재유입 합성도 가능"],
                ["가입", "registrations", "Y 선택", "주간 합계", "정의·중복제거 기준 고정"],
                ["재유입", "reactivations", "Y 선택", "주간 합계", "재가입/복귀 정의 고정"],
                ["매출", "revenue", "Y 선택", "주간 합계", "통화와 환불 처리 고정"],
                ["구매자", "purchasers", "Y 선택", "주간 합계", "주간 unique 기준 권장"],
                ["이벤트/구조변화", "holiday, promo, outage", "선택", "주간 발생 여부/step", "숫자 또는 인식 가능한 이진 0/1만 허용"],
            ],
            [24, 38, 20, 34, 58],
            styles,
        ),
        body(
            "숫자는 천 단위 쉼표·과학 표기와 명시적 규모 접미사(K/M/B, 천/만/백만/억)를 해석합니다. 예를 들어 1.2M은 1,200,000, 3억원은 300,000,000입니다. 1.2MB처럼 의미가 모호한 접미사는 숫자 1.2로 조용히 축소하지 않고 오류로 처리합니다. 날짜 열의 5자리 Excel serial은 메인 MMM·실험·국가 prior 모두 같은 1900 날짜 체계의 UTC 일자로 변환합니다. 플랫폼/세그먼트가 행으로 나뉜 CSV는 같은 주의 행을 합쳐야 하므로 행순서 확인만으로 대신할 수 없고 날짜 또는 주차 열이 반드시 필요합니다.",
            styles,
        ),
        heading("3.3 다중 KPI 매핑", 2, styles),
        body(
            "총유입·가입·재유입·매출·구매자 중 실제 열이 있는 목표만 활성화됩니다. 분석 후 상단 sticky 목표 선택기에서 KPI를 바꾸면 같은 매체·이벤트·구조변화 구조로 각 목표 결과를 탐색할 수 있습니다. 총유입 열이 없고 가입과 재유입이 모두 있으면 두 열의 합을 총유입 슬롯으로 사용할 수 있지만, 같은 값을 RR/Total 같은 여섯 번째 중복 목표로 다시 노출하지 않습니다.",
            styles,
        ),
        callout(
            "Y 개수가 다르면",
            "타깃 MMM에는 있지만 실험 또는 국가 prior 파일에 매핑되지 않은 KPI에는 prior가 적용되지 않습니다. 해당 목표는 관측 데이터 기반 기본 모델로 남으며, 화면에 미적용 상태를 표시해야 합니다.",
            styles,
            "amber",
        ),
        heading("3.4 이름 매핑 규칙", 2, styles),
        bullets(
            [
                "타깃 파일의 meta_spend를 보정하려면 prior 파일에도 같은 채널을 meta_spend로 매핑해야 합니다.",
                "대소문자·공백·접두어가 다르면 자동 연결을 신뢰하지 말고 매핑 화면에서 확인합니다. 한글 등 Unicode 헤더도 이름 자체로 안정적인 내부 key를 만들지만, 의미가 같은지는 사람이 확인해야 합니다.",
                "Y도 같은 비즈니스 정의로 연결해야 합니다. 단지 헤더가 같다고 단위·전환창이 같다고 검증되는 것은 아닙니다.",
                "국가 코드와 통화가 다르면 계수 단위가 달라지므로 환율·KPI 스케일을 먼저 통일합니다.",
            ],
            styles,
        ),
        heading("3.5 플랫폼 분리", 2, styles),
        body(
            "platform 열 또는 Android/iOS 태그 열을 매핑하면 Total과 플랫폼별 결과를 전환할 수 있습니다. Total은 같은 주의 플랫폼 KPI·spend를 합산하고, Android와 iOS는 각자 별도 Y 모델을 적합합니다. 두 플랫폼 차이가 커도 한쪽 계수를 다른 쪽에서 자동 참조하거나 평균내지 않습니다. 차이가 실제 유저 구성·가격·측정창 때문인지 확인하고 별도 결론으로 보고하세요.",
            styles,
        ),
        callout(
            "실험 prior도 같은 플랫폼 grain만 사용",
            "Android 또는 iOS 결과에 prior를 붙이려면 실험 파일에 같은 platform 행이 있거나, 그 플랫폼 태그가 붙은 Y가 명시적으로 매핑되어야 합니다. Total은 매핑된 모든 플랫폼 Y를 합산하지만, 구성 Y 하나라도 빠진 행은 제외합니다. Total이나 다른 OS 값을 선택 플랫폼에 대신 빌려 쓰지 않습니다.",
            styles,
            "amber",
        ),
        heading("3.6 Long-format 입력", 2, styles),
        body(
            "week/date | channel | spend | Y 형태도 지원합니다. 같은 기간·세그먼트의 채널별 행에는 전체 Y와 이벤트/step 값을 똑같이 반복하고, spend만 채널별 값으로 넣습니다. 앱은 spend를 wide 채널 열로 pivot하지만 반복 Y를 더하지 않습니다. 빈 시간·빈 채널 행, 서로 다른 반복 Y/이벤트 값은 조용히 버리거나 첫 값을 택하지 않고 분석을 차단합니다. 따라서 원자료 행 순서를 뒤집어도 같은 결과 또는 같은 차단 진단이 나옵니다.",
            styles,
        ),
    ]

    chapter(s, "4. 일별 데이터의 주간 전처리", styles)
    s += [
        heading("4.1 월요일 시작 주차", 2, styles),
        body(
            "각 날짜는 그 날짜가 포함된 월요일 시작 주차에 배정됩니다. 일요일까지 한 주로 묶은 뒤 시간순으로 정렬합니다. 이 방식은 일별 변동을 광고 잔효보다 짧은 노이즈로 과대해석하는 것을 줄이고, MMM 입력 단위를 일관되게 만듭니다.",
            styles,
        ),
        formula(
            [
                "week_start(d) = Monday of the calendar week containing date d",
                "weekly_spend[w] = sum(spend[d]) for d in week w",
                "weekly_kpi[w]   = sum(kpi[d])   for d in week w",
                "weekly_event[w] = 1 if any event[d] = 1 in week w, else 0",
            ],
            styles,
        ),
        heading("4.2 합계와 발생 여부의 차이", 2, styles),
        body(
            "광고비·유입·가입·재유입·매출·구매자는 흐름값이므로 합계가 기본입니다. 명절·프로모션·장애처럼 0/1 이벤트는 7일 합계가 아니라 그 주 발생 여부로 처리합니다. 이벤트와 구조변화 열은 숫자 또는 앱이 인식하는 이진값으로 정확히 0/1이어야 하며, 공란·다른 숫자를 0으로 간주하지 않고 분석을 차단합니다. 이벤트가 3일 있었다고 강도가 자동으로 3배가 되는 것을 막기 위해서입니다.",
            styles,
        ),
        heading("4.3 결측·중복·부분 주", 2, styles),
        data_table(
            ["문제", "앱 처리", "사용자 조치"],
            [
                ["invalid/빈 날짜", "행 제외 후 분석 차단 이슈", "원본 날짜 수정"],
                ["같은 날짜/주차 중복", "동일 platform grain이면 분석 차단", "원천 단위 확인 후 중복 제거"],
                ["빠진 주차", "calendar gap 분석 차단", "실제 KPI·spend 주차 행 추가"],
                ["내부 partial week", "최빈 5/7일 cadence보다 적으면 차단", "빠진 일자 복구"],
                ["첫/마지막 partial", "자동 제외 + 경고", "완전 주만 쓸지 확인"],
                ["매체비/KPI 공란", "0으로 합산하지 않고 선택 Y/채널 분석 차단", "실제 무집행만 0, 수집 실패는 복구"],
                ["음수 매체비", "분석 차단", "환불·보정 행을 원천 정의에 맞게 정리"],
                ["이벤트/step이 0/1 아님", "분석 차단", "정확한 이진값으로 수정; 공란을 0으로 대체하지 않음"],
                ["비율 KPI", "자동 보정 안 함", "분자·분모 원자료로 재정의"],
            ],
            [40, 72, 62],
            styles,
        ),
        callout(
            "주간화가 해결하지 못하는 것",
            "주간 집계는 공선성·누락된 교란요인·측정 정의 불일치를 해결하지 않습니다. 단지 시간 단위를 맞추고 일별 노이즈를 줄이는 전처리입니다. 이 앱은 임의의 연속형 가격·경쟁 통제열을 직접 매핑하지 않습니다. 의미 있는 변화 시점은 근거가 있을 때만 0/1 이벤트 또는 step으로 표현하고, 그렇지 못한 요인은 모델 한계로 공개하세요.",
            styles,
            "red",
        ),
    ]

    chapter(s, "5. 모델 구조", styles)
    s += [
        heading("5.1 결과 방정식", 2, styles),
        body(
            "각 KPI는 별도 모델로 적합합니다. 자연수요 수준과 장기 추세, 계절성, 이벤트·구조변화, 변환된 매체 입력을 더해 주간 KPI를 설명합니다.",
            styles,
        ),
        formula(
            [
                "y[t] = intercept + trend[t] + seasonality[t] + events[t]",
                "       + sum_m beta[m] * Hill(Adstock(spend[m,t])) + error[t]",
                "error[t] ~ Normal(0, sigma^2)",
            ],
            styles,
        ),
        heading("5.2 비매체 성분", 2, styles),
        data_table(
            ["성분", "역할", "해석 주의"],
            [
                ["Trend", "절편과 장기 방향", "브랜드 자연수요 전체와 동일한 개념은 아님"],
                ["Seasonality", "설정된 주기의 sin/cos 반복 패턴", "불규칙 이벤트는 별도 열 필요"],
                ["Holidays & Events", "명절·프로모션·장애 등 알려진 충격", "미래 발생을 모르면 예측에 0 또는 시나리오 입력"],
                ["Regime change", "측정·상품·정책 변화의 단계 효과", "광고 효과와 중복 설명하지 않게 시점 근거 필요"],
                ["Performance / Brand", "매핑된 채널의 주차별 기여", "그룹 합은 보고 단위이며 채널 식별은 별도 확인"],
            ],
            [34, 70, 70],
            styles,
        ),
        body(
            "기본 계절성 grid는 연간 52.18주와 분기 13.04주이며, 각 주기마다 sin/cos 한 쌍을 사용합니다. 별도 월·요일·국가 달력 효과를 자동 생성하지 않습니다.",
            styles,
        ),
        callout(
            "자동 달력·임의 step 없음",
            "모델은 '한국 명절 주차'를 국가 이름으로 하드코딩하지 않으며 42주·55주 같은 임의 시점 step도 만들지 않습니다. 명절·프로모션·측정 변경은 사용자가 매핑한 이벤트/step 열만 사용합니다. 공선성이 높은 step도 조용히 자동 삭제하지 않고 진단으로 알리므로, 유지·통합·제거는 실제 변경 근거를 보고 결정해야 합니다.",
            styles,
            "teal",
        ),
        heading("5.3 표준화와 원 단위 복원", 2, styles),
        body(
            "수치 안정성을 위해 회귀 입력은 열별 평균을 빼고 표준편차로 나눠 적합합니다. 화면의 계수·기여·prior는 다시 원래 변환 feature 단위와 KPI 단위로 환산합니다. KPI를 원에서 천원으로 바꾸더라도 같은 불확실성 구조가 유지되도록 calibrated prior precision도 스케일에 맞게 변환합니다.",
            styles,
        ),
        formula(
            [
                "z[j,t] = (x[j,t] - mean(x[j])) / sd(x[j])",
                "beta_raw[j] = beta_standardized[j] / sd(x[j])",
                "Var(beta_standardized prior) = Var(beta_raw prior) * sd(x[j])^2",
            ],
            styles,
        ),
        heading("5.4 공선성", 2, styles),
        body(
            "채널 두 개가 거의 같은 주차에 같은 비율로 움직이면 합산 효과는 설명해도 개별 효과는 구분하기 어렵습니다. prior는 정보를 추가할 수 있지만, 잘못된 prior로 식별 불가능을 가리는 용도로 쓰면 안 됩니다. 이런 경우 채널 통합, 추가 기간 확보, geo/holdout 실험이 우선입니다.",
            styles,
        ),
    ]

    chapter(s, "6. Empirical-Bayes 추론 방식", styles)
    s += [
        heading("6.1 조건부 Gaussian 분석 근사", 2, styles),
        body(
            "이 앱은 수천 번의 posterior 샘플을 생성하지 않습니다. 잔차분산 sigma²를 데이터에서 plug-in 추정하고, 그 값에 조건부로 선형 Gaussian likelihood와 정규 prior/약한 ridge penalty를 결합해 계수 평균과 공분산을 행렬 계산으로 구합니다. sigma²까지 적분한 Student-t posterior나 완전 계층형 joint posterior가 아니라 empirical-Bayes 분석 근사입니다. 같은 입력은 항상 같은 결과를 내며 브라우저에서 빠르게 실행됩니다.",
            styles,
        ),
        formula(
            [
                "Likelihood: y | beta ~ Normal(X beta, sigma^2 I)",
                "Calibrated prior: beta[j] ~ Normal(mu[j], v[j])",
                "Posterior precision = X'X / sigma^2 + prior_precision",
                "Posterior mean = inverse(Posterior precision) * (X'y / sigma^2 + prior_precision * mu)",
            ],
            styles,
        ),
        heading("6.2 기본 정규화와 calibrated prior", 2, styles),
        body(
            "외부 근거가 없는 계수에는 과적합을 줄이는 약한 ridge penalty가 적용됩니다. 실험·국가 prior가 있는 매체 계수에는 실제 Normal(mean, variance)의 precision이 적용됩니다. 구현은 잔차분산을 plug-in 추정하고 prior penalty를 잔차 스케일에 맞춰 고정점 갱신합니다. 이 절차는 KPI 단위 변경에 대한 prior 상대 강도를 보정하지만, sigma² 자체의 posterior 불확실성을 적분하지는 않습니다.",
            styles,
        ),
        heading("6.3 효과 확률과 90% 구간", 2, styles),
        body(
            "prior로 대표 변환이 고정된 채널은 조건부 계수 평균·표준편차로 양수 확률과 90% 구간을 계산합니다. prior가 없는 채널에서 변환 후보를 평균할 때는 후보별 양수 확률을 BIC 가중 평균하고, 효과 90% 구간은 가중 Gaussian mixture의 누적분포를 직접 뒤집어 5%·95% 분위수를 찾습니다. 따라서 profile 구간은 혼합 평균·분산으로 만든 정규근사가 아니라 후보가 갈릴 때 비대칭·다봉성까지 반영한 mixture CDF 분위수입니다.",
            styles,
        ),
        formula(
            [
                "F_mix(x) = sum_k weight[k] * Phi((x - mean[k]) / sd[k])",
                "CI90 = [inverse_F_mix(0.05), inverse_F_mix(0.95)]",
            ],
            styles,
        ),
        callout(
            "샘플링 진단은 표시하지 않음",
            "MCMC를 실행하지 않으므로 R-hat, effective sample size, trace plot은 계산할 수 없습니다. 해당 수치를 흉내 내지 않고 '해당 없음'으로 처리합니다.",
            styles,
            "amber",
        ),
        heading("6.4 속도와 정확도의 교환", 2, styles),
        data_table(
            ["장점", "대가"],
            [
                ["브라우저에서 빠르고 결정론적", "비선형·계층 posterior 전체 모양을 직접 샘플링하지 않음"],
                ["prior 평균·분산이 명시적", "모델 오지정이나 공선성을 posterior가 자동 해결하지 않음"],
                ["다중 KPI 전환이 용이", "각 KPI가 별도 모델이며 KPI 간 공분산을 공동 추정하지 않음"],
                ["서버 전송 불필요", "대규모 geo 패널·수천 후보는 브라우저 한계가 있음"],
            ],
            [66, 108],
            styles,
        ),
    ]

    chapter(s, "7. 광고 잔효·포화·모델 평균", styles)
    s += [
        heading("7.1 기하 adstock", 2, styles),
        body(
            "광고 효과가 집행 주에 끝나지 않는다고 보고 이전 주의 노출 상태를 alpha 비율로 다음 주에 넘깁니다. alpha가 클수록 잔효가 오래갑니다. Geo 실험 원자료는 지역별로 상태를 따로 계산해 한 지역의 마지막 주 잔효가 다음 지역으로 흘러가지 않게 합니다.",
            styles,
        ),
        formula("adstock[t] = spend[t] + alpha * adstock[t-1],  0 <= alpha < 1", styles),
        heading("7.2 Hill 포화", 2, styles),
        body(
            "반포화점 ec는 반응이 최대값의 절반에 도달하는 adstock 수준이고, slope는 곡선 굴곡을 정합니다. 지출이 커질수록 추가 1원의 효과가 줄어드는 패턴을 표현합니다.",
            styles,
        ),
        formula("hill(a; ec, slope) = a^slope / (a^slope + ec^slope)", styles),
        heading("7.3 후보 생성과 대표 변환", 2, styles),
        body(
            "각 채널에서 alpha x ec x slope 후보를 비교합니다. 고정 grid는 alpha = 0.0, 0.1, ..., 0.8; ec = 해당 채널의 양수 adstock 분포 40%·60%·80% 분위수; slope = 0.6, 0.8, 1.0, 1.4입니다. 먼저 비매체 요인을 제거한 잔차와의 관계 크기로 대표 변환을 고르고, 관계의 부호는 이후 계수 근사가 판단합니다. 이 대표 변환은 주차별 기본 기여분해와 미래예측에 사용됩니다. profile fit 예산은 외부 prior가 없으면 채널당 최대 48·전체 480, prior가 하나라도 있으면 전체 240이며, profile이 필요한 no-prior 채널 수로 균등 배분합니다.",
            styles,
        ),
        heading("7.4 profile 모델 평균", 2, styles),
        body(
            "prior가 없는 채널의 효과 확률·구간·반응곡선·예산 추천은 대표 변환 하나만 믿지 않습니다. 한 채널의 후보를 바꾸고 다른 채널은 대표 변환에 고정한 profile 모델을 각각 재적합한 뒤 BIC 차이로 가중합니다. On/Off 실험 prior는 타깃 대표 alpha·ec·slope로 처리강도를 변환하고, Geo prior는 선형 adstock ratio를 겹치는 타깃 기간의 Hill 미분으로 같은 계수 단위에 정렬합니다. 국가 prior는 각 참고국을 타깃의 같은 alpha·ec·slope로 다시 적합합니다. prior가 있는 채널은 이 정렬된 대표 변환에 고정하며 다른 변환에 같은 prior 숫자를 재사용하지 않습니다.",
            styles,
        ),
        formula(
            [
                "weight[k] proportional to exp(-0.5 * (BIC[k] - min(BIC)))",
                "mean_mix = sum_k weight[k] * mean[k]",
                "var_mix  = sum_k weight[k] * (sd[k]^2 + mean[k]^2) - mean_mix^2",
                "effective_candidates = 1 / sum_k weight[k]^2",
            ],
            styles,
        ),
        callout(
            "중요한 범위",
            "이는 모든 채널 후보의 데카르트 곱을 동시에 평균하는 joint Bayesian model average가 아닙니다. 채널별 one-at-a-time profile 평균입니다. 따라서 채널 간 변환 불확실성의 모든 상호작용을 포착하지 않습니다.",
            styles,
            "red",
        ),
        heading("7.5 반응곡선과 정상상태", 2, styles),
        body(
            "반응곡선의 x축은 한 주만 집행한 충격이 아니라 지속 가능한 주간 spend 수준입니다. 따라서 각 후보에서 steady-state adstock = spend/(1-alpha)를 사용합니다. alpha가 바뀌면 같은 주간 spend의 누적 노출과 한계효과도 달라집니다.",
            styles,
        ),
    ]

    chapter(s, "8. 실험 prior: On/Off와 Geo", styles)
    s += [
        heading("8.1 왜 점추정 하나가 아니라 원자료인가", 2, styles),
        body(
            "실험 원자료를 제공하면 효과 크기뿐 아니라 불확실성도 같은 설계에서 추정할 수 있습니다. On/Off는 KPI 처리효과를 타깃 alpha·ec·slope로 만든 transformed exposure 처리효과로 나눕니다. Geo는 비선형 Hill을 지역별로 적용한 뒤 더하지 않고, 먼저 지역별 선형 adstock 처리효과로 나눈 뒤 실험과 타깃 기간이 겹치는 national adstock 운용점의 Hill 미분으로 타깃 계수 단위에 옮깁니다. 같은 행·같은 설계의 cross-equation covariance, delta method, Fieller ratio 구간과 jackknife로 오차를 전파합니다.",
            styles,
        ),
        formula(
            [
                "On/Off prior_mean = effect_KPI / effect_Hill(adstock)",
                "Geo r_A = DiD_effect_KPI / DiD_effect_geo_adstock",
                "Geo prior_mean = r_A / Hill_derivative(target_overlap_adstock)",
                "Var(y/x) approximately Var(y)/x^2 + y^2 Var(x)/x^4",
                "                         - 2*y*Cov(y,x)/x^3",
                "require a bounded two-sided 90% Fieller ratio interval",
                "prior_variance = max(delta_variance * inflation^2, Fieller_equivalent_variance, jackknife_SE^2 * inflation^2)",
                "prior_precision = 1 / prior_variance",
            ],
            styles,
        ),
        heading("8.2 실험 유형 판별과 지원 입력", 2, styles),
        body(
            "업로드 직후 기본값은 Auto입니다. Auto는 type 열이 있으면 그 값을 가장 먼저 사용하고, type이 없으면 Geo wide/long 스키마를 확인한 뒤 나머지를 On/Off로 판별합니다. type은 Geo·OnOff처럼 파일 전체에서 하나의 해석 가능한 값이어야 합니다. 자동 판별이 데이터 의도와 다르면 화면의 실험 유형 선택기에서 On/Off 또는 Geo를 강제할 수 있으며, 강제 선택이 type 열과 자동 스키마 판정보다 우선합니다. 화면에는 판별된 유형과 판별 근거를 함께 표시합니다.",
            styles,
        ),
        data_table(
            ["형태", "필수 열", "정규화"],
            [
                ["On/Off wide", "type(선택), time, state, KPI, 대상 channel spend", "주차별 1행으로 사용"],
                ["Geo long", "type(선택), time, period, geo, arm, KPI, 대상 channel spend", "geo x 주차 패널로 사용"],
                ["Geo wide", "type(선택), time, period, target_geo, control_geo, target_/control_ KPI·spend 쌍", "각 행을 treatment·control 두 geo 행으로 변환"],
                ["매체 long", "time, channel, spend와 위 설계 열·반복 KPI", "메인 MMM과 같은 채널 헤더의 spend wide 열로 pivot"],
            ],
            [32, 77, 65],
            styles,
        ),
        callout(
            "템플릿의 헤더를 실제 매핑명으로 변경",
            "화면에서 On/Off, Geo wide, Geo long 예시 CSV를 내려받을 수 있습니다. 예시의 registrations와 meta_spend는 메인 MMM에 매핑한 실제 Y·채널 헤더와 정확히 같게 바꾸세요. 매체 long 파일의 channel 값도 같은 채널로 매핑될 수 있어야 하며, 같은 time·geo·platform에 반복된 KPI가 서로 다르면 첫 값을 임의 선택하지 않고 보류합니다.",
            styles,
            "teal",
        ),
        heading("8.3 일별 원자료의 실험 주차 생성", 2, styles),
        body(
            "날짜가 파싱되는 일별 실험 파일은 geo가 있으면 geo x 월요일 시작 주차, geo가 없으면 월요일 시작 주차로 먼저 묶습니다. KPI와 대상 채널 spend는 주간 합산합니다. 잘못된 날짜 행은 제외하고, 같은 주 안에서 state·arm·period가 섞인 경계 주와 주 안 일부 행의 KPI 또는 spend가 결측인 주는 통째로 제외합니다. 관측된 주들의 최빈 cadence로 5일/7일을 판정해 첫·마지막 partial week는 제외하고, 내부 partial week나 빠진 주차·중복 주차가 있으면 adstock 시간을 압축하지 않도록 prior 생성을 보류합니다.",
            styles,
        ),
        data_table(
            ["진단", "화면/내보내기 의미"],
            [
                ["source rows", "업로드한 원자료 행 수"],
                ["usable weeks", "주간화·검증을 통과해 prior 계산에 쓴 geo-week/주차 수"],
                ["unparseable date rows", "날짜 해석 실패로 제외된 행 수"],
                ["mixed boundary weeks", "한 주에 state/arm/period가 둘 이상이라 제외한 주 수"],
                ["missing weeks", "주 내 KPI/spend 일부 결측 때문에 제외한 주 수"],
                ["partial/gap diagnostics", "경계 partial 제외 수와 내부 partial·빠진 주차·중복 주차 차단 사유"],
            ],
            [55, 119],
            styles,
        ),
        callout(
            "제외는 보수적 식별 규칙",
            "경계 주를 다수결로 ON 또는 POST에 억지 배정하지 않습니다. 원자료→사용 주차와 제외 사유를 함께 남겨 prior가 어떤 표본에서 계산됐는지 재현할 수 있게 합니다.",
            styles,
            "teal",
        ),
        body(
            "플랫폼별 prior는 선택한 플랫폼과 같은 platform 행 또는 Android/iOS 태그가 붙은 해당 Y만 사용합니다. Total은 매핑된 플랫폼 Y를 모두 합산하며, 구성 Y가 하나라도 결측인 행은 계산에서 제외합니다. Total이나 다른 OS의 결과를 선택 플랫폼 prior로 대체하지 않습니다.",
            styles,
        ),
        heading("8.4 On/Off 입력", 2, styles),
        data_table(
            ["열", "내용", "예시"],
            [
                ["time", "날짜 또는 주차", "2026-01-05"],
                ["state", "ON/OFF 상태", "on, off"],
                ["channel spend", "대상 채널 집행액", "meta_spend"],
                ["KPI", "타깃과 같은 정의의 결과", "registrations"],
            ],
            [35, 84, 55],
            styles,
        ),
        body(
            "ON-OFF-ON처럼 상태가 반복되는 기간 데이터가 필요합니다. prior 계산에는 검증을 통과한 주간 관측치가 최소 16개, ON·OFF 각각 최소 4주, 상태 전환 최소 2회가 필요합니다. ON 1주/OFF 15주나 단 한 번 켰다가 끝난 구간은 자동 prior가 되지 않습니다. spend만으로 상태를 찾을 때도 검증된 0만 OFF로 쓰며 결측을 0으로 바꾸지 않습니다. 시계열 오차에는 HAC 표준오차와 block jackknife를 사용하며, HAC 계산이 실패하면 일반 OLS 표준오차로 후퇴하지 않고 prior를 보류합니다. 이 변환기는 promo·outage 같은 추가 연속 통제열을 회귀에 넣지 않으므로 동시 충격은 별도로 공개하세요.",
            styles,
        ),
        heading("8.5 Geo 입력", 2, styles),
        data_table(
            ["열", "내용", "예시"],
            [
                ["time", "동일한 관측 주차", "2026-W08"],
                ["geo", "지역 식별자", "Seoul, Busan"],
                ["arm", "target/control", "treatment, control"],
                ["period", "pre/post", "pre, post"],
                ["channel spend", "지역별 대상 채널 집행", "search_spend"],
                ["KPI", "지역별 결과", "revenue"],
            ],
            [35, 84, 55],
            styles,
        ),
        body(
            "Geo prior에는 비교 가능한 날짜/주차 열, 검증된 geo-week 관측치 최소 16개, 최소 4개 geo, treatment와 control 각각 최소 2개 geo가 필요합니다. 각 geo의 arm은 전 기간 고정되어야 하고, 같은 주의 pre/post 상태는 모든 geo에서 같아야 하며, 모든 geo가 pre와 post를 모두 가져야 합니다. treatment/control x pre/post 네 셀 중 하나라도 없으면 보류합니다. 앱은 geo·주차 고정효과를 포함한 treatment x post DiD를 지역별 선형 adstock에 대해 추정합니다. cluster covariance가 실패하면 OLS SE로 후퇴하지 않고, 모든 geo 삭제 적합이 성공할 때만 LOCO를 인정합니다. 효과/처리강도 ratio의 양측 90% Fieller 구간이 bounded가 아니면 보류합니다. 실험과 타깃 MMM 주차가 최소 4주 겹쳐야 national Hill 미분 기준점을 만들 수 있으며, 겹침이 없거나 미분이 사실상 0이면 단위 정렬 실패로 보류합니다.",
            styles,
        ),
        formula(
            [
                "inflation = max(1, t_critical(0.90, df) / 1.645)",
                "prior_variance = max(cluster_delta_variance * inflation^2, Fieller_equivalent_variance, LOCO_SE^2 * inflation^2)",
            ],
            styles,
        ),
        callout(
            "한 holdout에서 여러 spend가 함께 바뀌면",
            "동일 파일에 spend 열이 여러 개면 앱은 실험 state/arm/period 대비로 충분히 변한 열을 먼저 찾습니다. 정확히 한 채널만 뚜렷하면 그 채널을 쓰고, 둘 이상이 함께 움직이면 총 결합효과는 보여도 채널별 효과를 분리할 수 없어 prior를 보류합니다. 선택된 채널도 transformed-exposure 효과가 0과 구분되지 않으면 ratio가 폭발할 수 있으므로 weak-intensity gate에서 보류합니다.",
            styles,
            "red",
        ),
        heading("8.6 90% 신뢰구간이 prior 강도가 되는 법", 2, styles),
        body(
            "현재 UI는 요약 CI 숫자만 받지 않고 기간 원자료에서 효과/처리강도 ratio의 delta 분산, 공분산, bounded 90% Fieller 구간과 jackknife를 직접 계산합니다. Fieller 구간이 unbounded/disjoint면 ratio prior를 만들지 않습니다. 유한하면 평균에서 더 먼 끝점의 폭을 1.645로 나눠 보수적인 대칭 Normal 분산 후보로 바꾸고, robust delta·jackknife와 비교해 가장 넓은 불확실성을 사용합니다. 구간이 넓을수록 precision이 낮아져 MMM 데이터가 prior를 쉽게 수정합니다. 임의의 강도 슬라이더는 없습니다.",
            styles,
        ),
        heading("8.7 동일 KPI·기간 재사용과 적용 전 확인", 2, styles),
        callout(
            "같은 결과를 prior와 likelihood에 두 번 넣지 않기",
            "실험 주차와 메인 MMM 주차가 겹치는 사실만으로 자동 탈락하지는 않지만, 같은 모집단의 동일 KPI 값을 복제해 양쪽에 넣으면 독립 근거가 아닙니다. 앱은 national On/Off에서 비교 가능한 중첩 주가 4개 이상이고 그중 95% 이상이 메인 MMM의 같은 주 Y와 수치적으로 일치하면 재사용 패턴으로 보고 prior를 자동 보류합니다. 날짜형과 숫자형 인덱스처럼 두 시간축 자체를 비교할 수 없을 때도 중복 사용을 배제할 수 없으므로 On/Off prior를 보류합니다. 부분 기간 중첩과 Geo 근거는 중첩 주수·정확 일치 주수를 진단에 표시하므로, 별도 처리군/대조군 집계에서 얻은 근거인지 사용자가 확인해야 합니다.",
            styles,
            "red",
        ),
        bullets(
            [
                "실험의 KPI 정의·전환창·통화·대상 사용자가 MMM과 같은가?",
                "실험 집행 강도가 MMM의 관측 범위 안에 있는가? 지나친 외삽은 아닌가?",
                "동시에 바뀐 프로모션·가격·크리에이티브가 없는가?",
                "실험 채널 헤더와 MMM 채널 매핑이 정확히 같은가?",
                "실험 시기와 현재 시장 사이의 전달 불확실성을 설명했는가?",
            ],
            styles,
        ),
        callout(
            "실험도 자동으로 완벽한 prior가 아님",
            "Meridian 공식 가이드도 실험의 estimand·기간·모집단과 MMM 목표가 다를 수 있으므로 추가 전달 불확실성을 고려하라고 설명합니다. 좁은 실험 CI를 무비판적으로 전체 기간에 강제하지 마세요.",
            styles,
            "amber",
        ),
    ]

    chapter(s, "9. 유사 국가 prior", styles)
    s += [
        heading("9.1 목적과 입력", 2, styles),
        body(
            "타깃 국가 MMM 파일과 같은 포맷의 여러 참고 국가 데이터를 업로드해, 타깃 국가에 전달 가능한 채널 계수 근거를 찾습니다. 메인 MMM CSV에는 정확히 하나의 COUNTRY 값, 참고 CSV에는 국가 구분 COUNTRY 열이 있어야 하며 각 참고 국가는 최소 24개 유효 주간 행이 필요합니다. 타깃 국가를 확정할 수 없으면 자기 데이터가 prior로 재유입되는 self-reference를 막기 위해 국가 prior 전체를 보류합니다. 매체와 KPI는 이름뿐 아니라 정의·단위까지 사용자가 확인해야 합니다.",
            styles,
        ),
        heading("9.2 두 단계 선택", 2, styles),
        bullets(
            [
                "1차 적격성: 데이터 길이·겹치는 채널·KPI·시간축 정합과 모델 적합 가능성을 확인하고 최대 12개 참고국을 1차 적합합니다. 각 적격 국가는 개별 카드로 노출합니다.",
                "공통 비교: 최대 12개 국가와 이후 조합을 똑같은 비중복 rolling-origin folds에서 평가합니다. 단일 holdout보다 안정적이지만, 같은 folds를 shortlist와 조합 선택에 재사용하므로 선택 편향을 제거한 독립 OOS는 아닙니다.",
                "조합 탐색: 동일 folds 점수가 좋은 상위 4개 국가만 shortlist한 뒤 최대 3개 국가 조합, 최대 24개 세트를 비교합니다.",
                "선택: 평균 오차뿐 아니라 fold 불안정성·2% 최소 개선·fold 승률·짝지은 fold 개선이 그 개선 잡음의 1 SE를 넘는지·국가 수 복잡도와 one-standard-error 단순성 규칙을 반영해 한 조합을 추천합니다.",
                "기본 모델이 더 낫거나 차이가 불안정하면 prior 미적용을 선택합니다.",
            ],
            styles,
        ),
        heading("9.3 반복 12주 검증", 2, styles),
        body(
            "기본 설정은 12주 창을 최근 시점부터 과거로 12주씩 이동해 서로 겹치지 않는 최대 3개 fold를 만듭니다. 각 fold는 최소 24주 학습 구간을 요구하며, 국가 prior 선택에는 최소 2개 fold가 필요합니다. 따라서 보통 타깃 국가에 최소 48개 유효 주가 있어야 하고 3개 fold가 더 안정적입니다. 36~47주는 한 fold만 만들어지므로 후보 점수가 좋아 보여도 base를 유지합니다. 실제 spend·0/1 이벤트·구조변화 등 타깃 국가 설명변수는 실제값을 넣고 KPI만 가린 상태에서 모든 후보를 동일 folds로 비교합니다.",
            styles,
        ),
        body(
            "후보 검증에서는 모든 folds 중 가장 이른 학습 cutoff에서 타깃 Y 평균과 대표 alpha·ec·slope를 한 번 고정합니다. 참고국 행도 그 cutoff까지 실제로 존재한 것만 사용하며, 이후 참고국 데이터나 가린 타깃 Y를 후보 prior에 넣지 않습니다. 국가별 spend 규모가 다르므로 각 채널의 양수 adstock 중앙값을 earliest-cut 타깃 운용 규모에 맞추는 배율을 적용한 뒤 같은 ec/Hill 단위로 참고국을 적합합니다. 날짜 정렬·변환·spend scale 중 하나라도 실패하면 그 국가는 보류됩니다. 조합을 선택한 뒤에만 선택국을 타깃 종료 주차까지의 참고기간과 전체 타깃 transform/Y scale로 재적합하며, 타깃 종료 뒤의 참고국 행은 사용하지 않습니다. 이 최종 수치에는 별도 독립 OOS가 없습니다.",
            styles,
        ),
        formula(
            [
                "spend_scale[m,c] = median_positive_adstock_target[m] / median_positive_adstock_reference[m,c]",
                "eligibility requires finite RMSE on every common fold",
                "mean_RMSE = mean(RMSE across all common folds)",
                "score = (mean_RMSE + 0.25 * sd_RMSE)",
                "        * (1 + 0.025 * max(0, number_of_countries - 1))",
            ],
            styles,
        ),
        heading("9.4 국가 간 전달 이질성", 2, styles),
        body(
            "참고 국가가 여러 개면 random-effects 방식으로 국가 간 평균 차이 tau^2를 추정하고 새 타깃 시장을 위한 predictive prior를 만듭니다. 한 국가만 있을 때는 이질성을 추정할 수 없으므로 posterior SD가 아무리 작아도 상대 SD 하한을 50%로 둡니다. 여러 국가이면 상대 SD 하한은 25%이며, tau^2와 within-country precision floor를 함께 적용합니다.",
            styles,
        ),
        formula(
            [
                "relative_floor = 0.50 if K = 1, else 0.25",
                "relative_var_floor = (relative_floor * max(|pooled_mean|, sqrt(median(within_var))))^2",
                "precision_floor_var = median(within_var) / max_effective_countries  (max = 3)",
                "predictive_var = tau^2 + max(pooled_mean_var, precision_floor_var, relative_var_floor)",
                "transfer_precision = 1 / predictive_var",
            ],
            styles,
        ),
        callout(
            "47개를 넣었다고 47개를 쓰지 않음",
            "후보가 많아도 타깃 예측을 안정적으로 개선하는 소수 근거만 남깁니다. 국가 수가 늘어날수록 자동으로 좋게 평가되지 않으며, 복잡도 패널티와 국가 간 이질성이 prior 과신을 억제합니다.",
            styles,
            "teal",
        ),
        heading("9.5 올바른 해석", 2, styles),
        body(
            "국가 rolling folds는 country-only prior가 base보다 가린 12주를 반복해서 개선하는지 보는 후보 tuning 자료입니다. 가장 이른 cutoff의 타깃 변환·Y scale·참고국 근거를 고정하므로 그 이후 정보 누수는 막지만, 같은 folds를 국가 shortlist와 조합 선택에 재사용합니다. 따라서 국가 prior가 선택되면 이를 독립 OOS 성능으로 다시 부르지 않으며 내부 OOS 표시는 비활성화합니다. 선택 후 타깃 종료일까지의 참고국·전체 타깃기간 재적합에서만 국가 prior를 만들고 별도 설계에서 추정된 실험 prior와 precision으로 결합합니다. 실험과 MMM이 같은 KPI 원자료를 공유했다면 실험 진단에 표시된 중복사용 경계도 함께 적용합니다. 예측 개선도 인과 전달의 증명은 아닙니다.",
            styles,
        ),
    ]

    chapter(s, "10. 검증과 모델 건강지표", styles)
    s += [
        heading("10.1 세 층의 검증", 2, styles),
        data_table(
            ["층", "질문", "주요 지표"],
            [
                ["적합", "관측 기간을 얼마나 설명하는가?", "R2, RMSE, wMAPE"],
                ["예측", "가린 미래 구간을 얼마나 맞추는가?", "외부 prior 없는 base의 최근 20% OOS, 국가 12주 earliest-cut as-of tuning"],
                ["식별·건강", "틀린 이유로 맞춘 흔적은 없는가?", "90% coverage, 잔차 ACF1, 음수 자연수요, prior shift"],
            ],
            [30, 70, 74],
            styles,
        ),
        heading("10.2 일반 OOS backtest", 2, styles),
        body(
            "48주 이상이고 외부 prior가 없을 때만 마지막 20%를 학습에서 제외한 base OOS를 표시합니다. 학습 구간 안에서 변환 파라미터를 다시 선택하고 holdout 기간의 실제 매체비로 순방향 예측합니다. 외부 prior가 켜지면 이 base-only 점수를 prior 모델의 독립 점수로 오해하지 않도록 내부 OOS를 비활성화합니다. 실험 prior는 자체 효과 CI·Fieller·HAC/cluster·jackknife 진단으로, 국가 prior는 earliest-cut 타깃 변환/Y/참고국 근거에 고정한 country-only 대 base rolling 12주 후보 tuning으로 평가합니다. 최종 전체기간 적합에서만 두 근거를 precision 결합합니다.",
            styles,
        ),
        heading("10.3 건강지표 읽기", 2, styles),
        data_table(
            ["지표", "의미", "점검 신호", "다음 행동"],
            [
                ["wMAPE", "절대오차/실제 절대합", "기본 모델 대비 악화", "이벤트·구조변화·변환·prior 재검토"],
                ["90% coverage", "실제가 예측 90% 구간 안인 비율", "너무 낮음 또는 거의 100%", "구간 과소/과대 추정 점검"],
                ["Residual ACF1", "한 주 잔차와 다음 주 잔차의 상관", "절대값 0.3 이상", "추세·계절·잔효 누락 점검"],
                ["Negative baseline", "자연수요 추정이 0 미만인 주 비중", "0보다 큼", "모델 오지정·외삽 의심"],
                ["Prior shift", "posterior와 prior 평균 차이/prior SD", "절대 2 이상", "실험 전달성·데이터 충돌 검토"],
                ["Top candidate weight", "한 변환 후보에 쏠린 비중", "너무 낮고 유효 후보 많음", "변환 결론 불확실"],
            ],
            [32, 53, 43, 46],
            styles,
        ),
        heading("10.4 예측 정확도와 인과 타당성은 다름", 2, styles),
        body(
            "가격 변화 같은 미관측 교란요인이 입력되지 않은 채 R2가 높아도 매체 계수는 공선성과 누락 편향 때문에 틀릴 수 있습니다. 이 앱은 연속 가격 통제열을 직접 매핑하지 않으므로, 근거 있는 변화 시점만 0/1 이벤트·step으로 표현하고 나머지는 한계로 공개해야 합니다. 반대로 캠페인 변화가 드문 시장은 인과 효과가 있어도 채널별 추정 구간이 넓을 수 있습니다. 예측 검증, 식별 진단, 외부 실험을 함께 봐야 합니다.",
            styles,
        ),
        callout(
            "R-hat 없음은 누락이 아니라 방법 차이",
            "Meridian은 MCMC 체인의 수렴을 R-hat과 trace로 진단합니다. 이 앱은 해석적 posterior이므로 체인이 없고, 대신 예측·잔차·baseline·prior 충돌을 진단합니다.",
            styles,
            "purple",
        ),
    ]

    chapter(s, "11. 결과 화면 해석", styles)
    s += [
        heading("11.1 기본 기여분해", 2, styles),
        body(
            "주차별 stacked contribution은 대표 변환 후보 하나로 계산합니다. Trend는 절편을 포함한 자연수요 수준과 장기 방향을 함께 표시하며, Seasonality·Events·Regime change·Performance·Brand가 더해져 fitted KPI가 됩니다. residual은 실제와 fitted의 차이입니다.",
            styles,
        ),
        formula("actual[t] = sum(group_contribution[g,t]) + residual[t]", styles),
        heading("11.2 기여 크기 비중", 2, styles),
        body(
            "드라이버 표의 비중은 각 그룹 주차별 기여의 제곱평균(RMS magnitude) 비중입니다. 변동을 크게 만든 그룹을 비교하는 진단값이며, 정확한 Shapley R2가 아닙니다. 총 기여량이나 증분 매출 비중으로 읽지 마세요.",
            styles,
        ),
        formula(
            [
                "magnitude[g] = mean(contribution[g,t]^2)",
                "share[g] = magnitude[g] / sum_h magnitude[h]",
            ],
            styles,
        ),
        heading("11.3 채널 효과 카드", 2, styles),
        data_table(
            ["항목", "해석"],
            [
                ["효과 평균", "변환된 media feature 1단위가 KPI에 연결되는 평균 계수"],
                ["90% 구간", "prior 채널은 대표 변환 조건부 Gaussian; no-prior 채널은 mixture CDF 5%·95% 분위수"],
                ["양수 확률", "후보별 posterior 양수 확률의 BIC 가중 평균"],
                ["후보 수", "prior 채널은 단위 고정으로 1개, no-prior 채널은 적합에 성공한 profile 후보"],
                ["유효 후보 수", "가중치가 실제로 분산된 정도. 1에 가까우면 한 후보 우세"],
                ["상위 후보 비중", "가장 큰 BIC 가중치. 낮으면 변환 선택 불확실"],
                ["현재 한계효과", "원본 통화 기준 고정 증액 단위(KRW 100만·USD 1천)의 반응 변화와 90% 구간. 표시 통화 토글은 숫자 표기만 바꾸며 계산 단위를 바꾸지 않음"],
            ],
            [49, 125],
            styles,
        ),
        heading("11.4 prior 토글", 2, styles),
        body(
            "prior 있음/없음을 같은 KPI에서 즉시 비교합니다. 평균·90% 구간·양수 확률·prior shift가 어떻게 바뀌는지, 구간이 지나치게 좁아지지 않는지 봅니다. base OOS는 외부 prior가 없는 모델의 참고값일 뿐 prior 모델과 동등한 독립 비교로 부르지 않습니다. 실험은 자체 효과 CI와 식별 진단, 국가는 earliest-cut as-of rolling 후보 tuning을 별도 표기합니다. 결론이 prior 하나에 완전히 의존하면 그 사실 자체가 발표해야 할 민감도입니다.",
            styles,
        ),
        callout(
            "점추정보다 범위",
            "채널 A와 B의 현재 한계효과 90% 구간이 상위 채널 구간과 겹치면 앱은 한 채널을 1위로 확정하지 않고 후보 그룹으로 표시합니다. '둘 다 증액 후보지만 추가 실험으로 구분'처럼 액션을 범위로 표현합니다.",
            styles,
            "amber",
        ),
    ]

    chapter(s, "12. 반응곡선·예산 추천·미래예측", styles)
    s += [
        heading("12.1 반응곡선", 2, styles),
        body(
            "prior가 없는 채널 곡선은 profile 후보들의 BIC 가중 평균이고, prior 채널은 단위가 고정된 대표 변환 곡선입니다. x축은 지속 주간 spend, y축은 모델이 추정한 media response입니다. 최근 평균 spend와 비교해 포화와 한계효과를 확인합니다.",
            styles,
        ),
        heading("12.2 예산 추천", 2, styles),
        bullets(
            [
                "효과 구간이 넓거나 양수 확률이 낮은 채널은 큰 폭의 증액보다 측정 우선입니다.",
                "한계효과 계산 단위는 원본 통화 기준 KRW 100만 또는 USD 1천으로 고정됩니다. 표시 통화 토글은 계산 단위를 바꾸지 않습니다.",
                "증액 후 지속 spend를 profile 후보별 정상상태 adstock으로 바꿉니다. BIC 가중치 상위 누적 95% 후보 중 하나라도 과거 adstock 최대를 넘으면 외삽으로 표시하고 예산 추천에서 제외합니다.",
                "상위 한계효과 90% 구간과 겹치는 채널은 후보 그룹으로 묶고 단일 순위를 만들지 않습니다.",
                "브랜드·퍼포먼스의 KPI 지연 차이, 최소계약, 입찰 학습, 재고 제약은 모델 밖 제약으로 추가합니다.",
                "예산 변경 후에는 새 데이터로 모델을 갱신하고, 가능하면 holdout으로 증분성을 확인합니다.",
            ],
            styles,
        ),
        heading("12.3 예산 액션 식별 게이트", 2, styles),
        body(
            "아래 조건 중 하나라도 해당하면 앱은 방향 탐색 결과는 보여도 직접적인 증액·감액 추천을 차단합니다. 전체 모델 식별과 각 채널의 집행 이력·효과·현재 한계효과를 모두 통과해야 합니다.",
            styles,
        ),
        data_table(
            ["게이트", "차단 기준", "의미"],
            [
                ["데이터 길이", "52주 미만", "앱 low-information 구간"],
                ["관측/파라미터", "주수 / 추정 파라미터 수 < 8", "모델 자유도 대비 정보 부족"],
                ["VIF", "어느 매체 변수든 VIF >= 10", "다중 공선성으로 개별 효과 불안정"],
                ["매체 관련 상관", "매체-매체 또는 매체-비매체 설명변수 |corr| >= 0.90", "채널별 예산 액션 분리 어려움"],
                ["채널 활성 주", "spend > 0인 주가 20주 미만", "채널 자체 변동 근거 부족"],
                ["채널 spend 변동", "관측기간 spend가 상수", "반응곡선·한계효과 식별 불가"],
                ["최근 활성", "최근 8주 모두 spend = 0", "현재 예산 액션과 연결하기 어려움"],
                ["효과 근거", "해당 채널 P(effect > 0) < 0.80", "증액을 지지할 확률 근거 부족"],
                ["한계효과 구간", "고정 증액 단위의 90% 구간 하한 <= 0", "현재 증액의 양의 반응 불확실"],
                ["변환 관측범위", "증액 후 정상상태 adstock이 profile 상위 누적 95% 후보의 과거 adstock 최대를 넘음", "flight형 채널 외삽도 표시하고 추천에서 제외"],
            ],
            [43, 53, 78],
            styles,
        ),
        heading("12.4 미래예측", 2, styles),
        body(
            "미래 spend 시나리오에 adstock 상태를 순차적으로 넘겨 KPI를 예측합니다. 추세와 주기성 feature는 미래 주차에 맞게 전진시키고, 구조변화는 마지막 알려진 상태를 유지합니다. 미래 명절·이벤트는 알려진 경우 명시적으로 제공해야 하며, 모르면 0인 기준 시나리오로 해석합니다.",
            styles,
        ),
        heading("12.5 예측구간", 2, styles),
        body(
            "예측구간은 잔차분산뿐 아니라 해당 미래 design row의 계수 불확실성 x'Cov(beta)x를 포함합니다. 먼 미래·관측 범위 밖 입력에서는 구간과 모델 가정의 위험을 함께 보고해야 합니다.",
            styles,
        ),
        formula("predictive_var(x*) = sigma^2 * (1 + x*' (X'X + penalty)^-1 x*)", styles),
        callout(
            "예측은 시나리오",
            "계획 spend가 실제로 집행되고, 가격·제품·경쟁·측정체계가 모델 가정대로 유지된다는 조건부 결과입니다. 확정 매출 약속이 아닙니다.",
            styles,
            "red",
        ),
    ]

    chapter(s, "13. KPI별 운영 방법", styles)
    s += [
        heading("13.1 sticky 목표 전환", 2, styles),
        body(
            "매핑된 KPI는 분석 화면의 sticky 선택기에 활성화됩니다. 목표를 바꾸면 같은 입력 구조를 유지하면서 해당 Y의 모델·prior·검증·반응곡선을 불러옵니다. KPI마다 계수 스케일과 식별성이 다르므로 한 목표의 결론을 다른 목표에 복사하지 않습니다.",
            styles,
        ),
        heading("13.2 퍼널 해석", 2, styles),
        data_table(
            ["목표", "주요 질문", "주의"],
            [
                ["총유입", "상단 퍼널 볼륨을 누가 만들었나?", "가입+재유입 합성 시 중복 여부 확인"],
                ["가입", "신규 획득에 어떤 채널이 연결되나?", "중복가입·어트리뷰션 창 고정"],
                ["재유입", "기존 사용자 복귀에 어떤 채널이 연결되나?", "리타게팅과 자연복귀 공선성"],
                ["구매자", "구매 사용자 수에 어떤 채널이 연결되나?", "주간 unique 정의"],
                ["매출", "가치에 어떤 채널이 연결되나?", "가격·환불 정의 고정; 프로모션은 정확한 0/1 이벤트로만 반영"],
            ],
            [31, 74, 69],
            styles,
        ),
        heading("13.3 KPI prior 적용표", 2, styles),
        body(
            "prior 관리 화면에서 채널 x KPI 매핑 상태를 확인합니다. 예를 들어 실험 파일에 가입만 있고 MMM에 가입·재유입·매출이 있으면 가입 모델에만 실험 prior가 적용됩니다. 국가 prior도 동일합니다. 미매핑 목표는 'prior 없음'으로 명확히 표시합니다.",
            styles,
        ),
    ]

    chapter(s, "14. Google Meridian과의 비교", styles)
    s += [
        heading("14.1 한눈에 보는 차이", 2, styles),
        data_table(
            ["항목", "이 앱", "Google Meridian"],
            [
                ["실행", "브라우저 메모리, 서버 전송 없음", "Python 패키지, 일반적으로 로컬/클라우드 연산"],
                ["추론", "sigma² plug-in empirical-Bayes 조건부 Gaussian 근사", "NUTS MCMC posterior sampling"],
                ["공간 구조", "타깃 1개 모델 + 선택적 국가 계수 prior", "geo-level 계층형 random coefficients 또는 national 모델"],
                ["매체 입력", "주간 spend 기반 채널 feature", "media execution과 spend, reach/frequency 지원"],
                ["잔효·포화", "기하 adstock + Hill; no-prior 채널 profile 평균, prior 채널 대표 변환 고정", "HillAdstock, 설정 가능한 lag/adstock 구조"],
                ["prior 종류", "계수 Normal prior: 실험/국가 효과와 분산", "ROI, mROI, contribution, coefficient priors 및 calibration"],
                ["시간 baseline", "선형 추세·Fourier 계절·이벤트·step", "knot 기반 time-varying intercept와 controls"],
                ["불확실성", "sigma² 조건부 Gaussian + 채널별 profile mixture CDF", "joint posterior samples로 전체 파라미터 불확실성"],
                ["검증", "base-only 20% OOS, 국가 12주 earliest-cut as-of tuning, 실험 Fieller/CI, fit/coverage/ACF/baseline/prior shift", "holdout_id, model fit, posterior predictive 및 MCMC diagnostics"],
                ["진단", "R-hat/ESS/trace 해당 없음", "R-hat, trace, ESS 등 sampling health"],
                ["결정성", "같은 입력은 같은 결과", "seed·chain·sampling 변동 관리 필요"],
                ["규모", "마케터용 빠른 다중 KPI UX", "GPU 권장 가능한 계산집약적 모델"],
            ],
            [31, 70, 73],
            styles,
        ),
        heading("14.2 일반적인 완전 Bayesian MMM과의 차이", 2, styles),
        data_table(
            ["항목", "이 앱", "완전 Bayesian MMM 계열"],
            [
                ["잔차분산", "sigma² plug-in 고정점 추정", "sigma²/오차분포에도 prior를 두고 적분 가능"],
                ["비선형 파라미터", "채널별 profile 후보 + BIC 가중", "adstock·포화·계수를 joint posterior로 함께 추정 가능"],
                ["계층 구조", "국가 효과를 외부 prior로 전달", "geo/채널 계수를 한 모델 안에서 partial pooling 가능"],
                ["계산", "결정론적 행렬 계산", "MCMC·VI·SMC 등 확률 추론"],
                ["진단", "예측·잔차·식별·prior shift", "위 항목 + chain 수렴·ESS·posterior predictive"],
            ],
            [38, 67, 77],
            styles,
        ),
        body(
            "따라서 이 앱을 단순히 'Bayesian이 아니다'라고 부르는 것도, Meridian과 같은 완전 Bayesian MMM이라고 부르는 것도 부정확합니다. 정확한 명칭은 Normal prior를 실제 분산으로 반영하는 empirical-Bayes 조건부 Gaussian 근사 MMM입니다.",
            styles,
        ),
        heading("14.3 반영한 Meridian 원칙", 2, styles),
        bullets(
            [
                "잔효와 포화를 분리해 매체 반응을 표현합니다.",
                "prior를 단순 가중치가 아니라 확률분포의 평균과 분산으로 다룹니다.",
                "실험 근거의 point estimate와 standard error를 calibration 출발점으로 사용합니다.",
                "in-sample 적합도와 holdout 예측을 분리하고, prior-posterior 충돌과 baseline 이상을 확인합니다.",
                "예측 정확도가 인과 타당성을 보장하지 않는다고 명시합니다.",
            ],
            styles,
        ),
        heading("14.4 현재 반영하지 않은 기능", 2, styles),
        data_table(
            ["기능", "미반영 이유/영향", "필요할 때"],
            [
                ["NUTS/MCMC", "브라우저 계산·메모리·대기시간 부담. joint posterior 미제공", "Python Meridian 또는 서버/로컬 분석환경"],
                ["geo 계층형 random effects", "국가 prior는 계수 전달이지 동일 모델의 partial pooling이 아님", "충분한 geo 패널과 인구 데이터 확보"],
                ["reach/frequency", "현재 spend 열 중심", "도달·빈도 품질이 높고 중복 정의 가능"],
                ["ROI/mROI prior", "현재 변환 feature 계수 단위 prior", "비용·매출 단위와 ROI estimand를 엄격히 정렬"],
                ["knot baseline", "현재 추세/Fourier/step 구조", "장기간 비선형 baseline과 충분한 데이터"],
                ["joint transform averaging", "채널별 profile 방식으로 계산량 제한", "오프라인 MCMC/SMC 또는 제한된 후보 joint 탐색"],
                ["posterior predictive sampling", "조건부 정규 예측 참고구간 사용", "비대칭·heavy-tail 불확실성이 중요할 때"],
            ],
            [39, 88, 47],
            styles,
        ),
        callout(
            "어느 쪽이 더 좋은가",
            "빠른 브라우저 분석·다중 KPI·민감 데이터 로컬 처리에는 이 앱이 유리합니다. geo partial pooling, reach/frequency, joint posterior, 표준 MCMC 진단이 핵심이면 Meridian이 더 적합합니다. 둘은 정확도 등급이 아니라 목적과 계산 구조가 다릅니다.",
            styles,
            "purple",
        ),
    ]

    chapter(s, "15. 정확도·인과·한계", styles)
    s += [
        heading("15.1 가장 큰 오차 원인", 2, styles),
        data_table(
            ["원인", "증상", "대응"],
            [
                ["채널 공선성", "구간 겹침·부호 불안정", "채널 통합, 실험, 변동 구간 추가"],
                ["누락된 교란요인", "매체 효과 과대·잔차 자기상관", "지원되는 프로모션·장애는 0/1 event/step으로 반영. 연속 가격·경쟁 변수는 직접 매핑되지 않으므로 기간 분리·외부 분석 또는 한계 공개"],
                ["측정 정의 변경", "step 시점 이후 residual 구조 변화", "regime 열 추가, 기간 분리"],
                ["prior 전달 실패", "prior shift 큼·국가 tuning 불안정", "분산 확대 또는 prior 제거"],
                ["짧은 데이터", "후보 간 결론 분산", "기간 확보, 후보 축소"],
                ["범위 밖 예산", "반응곡선 외삽", "관측 범위 내 점진 변경"],
            ],
            [40, 65, 69],
            styles,
        ),
        heading("15.2 양수 확률의 언어", 2, styles),
        data_table(
            ["상태", "권장 표현", "금지 표현"],
            [
                ["높고 구간 양수", "양의 효과를 지지하는 근거가 강함", "확실히 인과효과가 있음"],
                ["중간/구간 0 포함", "방향은 양수이나 불확실, 실험 필요", "효과 없음"],
                ["낮거나 음수", "이 데이터·가정에서 양의 효과 근거 부족", "광고가 반드시 해로움"],
                ["공선 경고", "개별 채널 식별 불가", "가장 나쁜 채널 확정"],
            ],
            [40, 84, 50],
            styles,
        ),
        heading("15.3 prior 선택 편향", 2, styles),
        body(
            "많은 국가·조합을 시험한 뒤 가장 좋은 하나를 고르면 우연한 승자를 선택할 수 있습니다. 반복 fold, 불안정성 가산, 복잡도 패널티가 이를 줄이지만 완전히 제거하지는 않습니다. 최종 추천은 다음 기간이나 독립 실험에서 다시 확인합니다.",
            styles,
        ),
        heading("15.4 개인정보와 데이터 처리", 2, styles),
        body(
            "CSV는 브라우저 메모리에서 처리되며 분석을 위해 서버로 전송하거나 저장하지 않습니다. 그래도 원본 파일에는 개인 식별정보를 넣지 말고, 국가·주차·채널 수준으로 집계한 데이터만 사용하세요.",
            styles,
        ),
    ]

    chapter(s, "16. 문제 해결", styles)
    s += [
        heading("16.1 업로드와 매핑", 2, styles),
        data_table(
            ["증상", "가능한 원인", "해결"],
            [
                ["날짜가 주차로 안 묶임", "날짜 형식 혼합·파싱 실패", "YYYY-MM-DD로 통일"],
                ["KPI가 활성화되지 않음", "Y 열 미매핑·문자열 값", "다섯 목표 중 해당 열을 다시 매핑"],
                ["prior가 특정 Y에 없음", "prior 파일에 같은 Y가 없음", "정상 동작. 미매핑 Y는 기본 모델 사용"],
                ["채널 prior가 안 붙음", "헤더/매핑 이름 불일치", "타깃과 prior의 채널 키를 동일하게 지정"],
                ["국가가 섞임", "country 열 없음/값 공란", "모든 행에 일관된 국가 코드 입력"],
            ],
            [45, 63, 66],
            styles,
        ),
        heading("16.2 모델", 2, styles),
        data_table(
            ["증상", "해석", "조치"],
            [
                ["효과 구간이 매우 넓음", "데이터 변동 부족·공선·후보 불확실", "기간/실험 추가, 채널 통합"],
                ["prior 후 구간이 지나치게 좁음", "실험 CI 또는 전달분산 과소", "정의 확인, 분산 확대/제거"],
                ["R2 높지만 base OOS 나쁨", "과적합·regime 변화", "이벤트/step 재검토, 결론 하향"],
                ["잔차 ACF 큼", "시간 구조 누락", "추세·계절·adstock 후보·이벤트 확인"],
                ["음수 자연수요", "baseline 오지정 또는 외삽", "모델 결과를 의사결정에 사용 중지 후 재설계"],
                ["상위 후보 비중 낮음", "잔효/포화 식별 약함", "곡선을 점이 아닌 범위로 사용"],
            ],
            [45, 65, 64],
            styles,
        ),
        heading("16.3 실험 prior", 2, styles),
        data_table(
            ["증상", "확인 순서"],
            [
                ["On/Off 생성 실패", "최소 16개 유효 주, ON·OFF 각각 4주, 상태 전환 2회, bounded Fieller, HAC·block jackknife 진단을 확인"],
                ["Geo 생성 실패", "최소 16개 geo-week·4개 geo·arm당 2개, 공통 pre/post·4개 셀, cluster·전 LOCO·bounded Fieller·타깃 Hill 미분 정렬을 확인"],
                ["동일 KPI 재사용 보류", "national On/Off KPI가 메인 MMM의 같은 주 Y와 정확히 일치하는지 확인하고 별도 실험 집계만 사용"],
                ["SE가 매우 큼", "실험 기간·geo 수·처리강도·동시 이벤트를 확인. 큰 SE는 약한 prior로 정상 반영"],
                ["효과 부호가 예상과 반대", "KPI 방향, state/arm/period 코딩, spend 단위, 시간 정렬을 재검토"],
                ["Geo마다 값이 튐", "지역별 표본 크기와 pre-trend를 확인하고 cluster 수가 충분한지 점검"],
            ],
            [49, 125],
            styles,
        ),
        heading("16.4 국가 prior", 2, styles),
        bullets(
            [
                "후보 0개: 겹치는 채널·KPI·기간·country 매핑을 확인합니다.",
                "각 참고 국가에 최소 24개 유효 주간 행이 있는지 확인합니다.",
                "모든 후보가 기본보다 나쁨: prior를 쓰지 않는 것이 올바른 결과입니다.",
                "타깃이 36~47주라 fold가 1개뿐이면 선택하지 않고 base를 유지합니다. 최소 2개 fold(보통 48주), 가능하면 3개를 확보합니다.",
                "10개 이상 추천되는 것처럼 보임: 실제 추천 조합과 개별 유의미 후보 목록을 구분합니다.",
                "fold별 승패가 바뀜: 평균만 보지 말고 sd와 복잡도 포함 score를 사용합니다.",
                "국가 간 계수 차이가 큼: tau^2가 precision을 낮추는 것이 정상입니다.",
            ],
            styles,
        ),
    ]

    chapter(s, "17. 발표·검토 체크리스트", styles)
    s += [
        heading("17.1 데이터 승인", 2, styles),
        bullets(
            [
                "분석 국가, 기간, 주차 정의, 통화, KPI 정의와 전환창을 문서화했다.",
                "일별→주간 집계 규칙과 이벤트 발생 여부 규칙을 확인했다.",
                "누락·중복·부분 주·측정 변경을 검토했다.",
                "지원되는 프로모션·명절·장애를 정확한 0/1 event/step으로 반영했다. 연속 가격·경쟁 변수는 직접 매핑되지 않는 한계와 정의 변화를 공개했다.",
            ],
            styles,
        ),
        heading("17.2 모델 승인", 2, styles),
        bullets(
            [
                "기본 모델과 prior 모델을 모두 비교했다.",
                "외부 prior 없는 base에서만 제공되는 OOS wMAPE와 coverage, residual ACF, negative baseline, prior shift를 확인했다.",
                "후보 수·유효 후보 수·상위 후보 비중을 기록했다.",
                "공선성과 구간 겹침이 큰 채널의 순위를 확정하지 않았다.",
                "기여 크기 비중을 Shapley R2라고 부르지 않았다.",
            ],
            styles,
        ),
        heading("17.3 prior 승인", 2, styles),
        bullets(
            [
                "실험 설계·기간·KPI·처리강도·CI 계산법을 공개했다.",
                "실험 KPI와 메인 MMM Y의 기간 중첩·정확 일치 진단을 확인하고, 동일 결과의 이중 사용이 없음을 확인했다.",
                "국가 정의·통화·전환창 일치를 사람이 검증했다.",
                "국가 12주 반복 fold와 복잡도 패널티 결과를 공개했다.",
                "미매핑 Y에 prior가 적용되지 않았음을 확인했다.",
            ],
            styles,
        ),
        heading("17.4 발표 문구 템플릿", 2, styles),
        callout(
            "권장 문구",
            "본 결과는 주간 관측 데이터에 광고 잔효·포화 후보와 정규 prior를 적용한 empirical-Bayes 조건부 Gaussian 근사 MMM입니다. 잔차분산은 plug-in 추정하며, 변환 불확실성은 채널별 profile BIC 평균으로 반영했습니다. 완전 계층형 joint MCMC 모델은 아닙니다. 채널별 수치는 인과 확정값이 아니라 실험·홀드아웃과 함께 사용하는 범위형 의사결정 근거입니다.",
            styles,
            "teal",
        ),
    ]

    chapter(s, "18. 용어집", styles)
    glossary_rows = [
        ["Adstock", "현재 집행과 과거 잔효를 합친 매체 상태"],
        ["alpha", "기하 adstock의 주간 잔존 비율"],
        ["Hill", "지출 증가에 따른 포화를 표현하는 S자/오목 반응함수"],
        ["ec / half-saturation", "Hill 반응이 절반에 도달하는 adstock 수준"],
        ["slope", "Hill 곡선의 굴곡·가파름"],
        ["Prior", "데이터 적합 전에 외부 근거로 둔 파라미터 분포"],
        ["Posterior", "관측 데이터와 prior를 결합한 뒤의 파라미터 분포"],
        ["Precision", "분산의 역수. 클수록 prior가 강함"],
        ["90% interval", "모델과 근사 아래 계수 불확실성을 나타내는 범위"],
        ["Profile model", "한 채널 후보만 바꿔 다시 적합한 비교 모델"],
        ["BIC weight", "적합도와 복잡도를 함께 반영한 후보 상대 가중치"],
        ["Effective candidates", "후보 가중치가 실제 몇 개에 분산됐는지 나타내는 역집중도"],
        ["OOS", "학습에 쓰지 않은 기간(out-of-sample)"],
        ["wMAPE", "절대오차 합을 실제값 절대합으로 나눈 비율"],
        ["Coverage", "실제가 예측구간 안에 들어온 비율"],
        ["Residual ACF1", "인접 주 잔차의 자기상관"],
        ["DiD", "처리/통제의 pre-post 차이를 다시 비교하는 차이의 차이"],
        ["HAC SE", "시계열 자기상관·이분산에 견고한 표준오차"],
        ["Cluster-robust SE", "같은 geo 내 오차 상관을 허용하는 표준오차"],
        ["Jackknife", "일부 블록을 순차 제외해 추정 불안정성을 재는 방법"],
        ["tau^2", "참고 국가 간 전달 계수의 이질성 분산"],
        ["Ridge", "계수 과대화를 줄이는 L2 정규화"],
        ["R-hat", "MCMC 체인 수렴 지표. 이 앱에는 체인이 없어 해당 없음"],
        ["Shapley R2", "변수 그룹의 설명력 기여를 순열로 배분한 값. 현재 MMM 비중표는 이것이 아님"],
        ["Incrementality", "광고가 없었을 반사실 대비 순증분 효과"],
    ]
    s += [
        data_table(["용어", "정의"], glossary_rows, [48, 126], styles),
    ]

    chapter(s, "부록 A. 계산·화면 대응표", styles)
    s += [
        data_table(
            ["화면 요소", "계산 원천", "검토 질문"],
            [
                ["주차별 기여", "대표 변환 + posterior 평균 계수", "대표 후보 의존성을 공개했나?"],
                ["효과 90% 구간", "prior 채널 조건부 Gaussian / no-prior profile mixture CDF 분위수", "0 포함과 후보 분산을 확인했나?"],
                ["양수 확률", "후보별 Gaussian 확률의 BIC 평균", "인과 확률로 과장하지 않았나?"],
                ["반응곡선", "정상상태 adstock의 후보 가중 반응", "관측 spend 범위 안인가?"],
                ["기여 크기 비중", "mean(contribution^2) 정규화", "Shapley R2라고 쓰지 않았나?"],
                ["실험 prior", "효과/노출 contrast 비율 + 보수적 variance", "실험 전달성이 맞나?"],
                ["국가 prior", "국가 계수 + tau^2 + rolling 선택", "후보 선택 편향을 공개했나?"],
                ["미래예측", "미래 feature + posterior predictive variance", "이벤트·regime 가정을 썼나?"],
            ],
            [43, 79, 52],
            styles,
        )
    ]

    chapter(s, "부록 B. 공식 참고자료", styles)
    sources = [
        ("Google Meridian - Model specification", "https://developers.google.com/meridian/docs/advanced-modeling/model-spec"),
        ("Google Meridian - ModelSpec API", "https://developers.google.com/meridian/reference/api/meridian/model/spec/ModelSpec"),
        ("Google Meridian - ROI priors and calibration", "https://developers.google.com/meridian/docs/advanced-modeling/roi-priors-and-calibration"),
        ("Google Meridian - Choosing treatment prior types", "https://developers.google.com/meridian/docs/advanced-modeling/how-to-choose-treatment-prior-types"),
        ("Google Meridian - Collect data", "https://developers.google.com/meridian/docs/pre-modeling/collect-data"),
        ("Google Meridian - Geo selection and national data", "https://developers.google.com/meridian/docs/pre-modeling/geo-selection-national-data"),
        ("Google Meridian - Model health checks", "https://developers.google.com/meridian/docs/post-modeling/health-checks"),
        ("Google Meridian - Model fit", "https://developers.google.com/meridian/docs/post-modeling/model-fit"),
        ("Google Meridian - Model diagnostics", "https://developers.google.com/meridian/docs/user-guide/model-diagnostics"),
        ("Google Meridian - Interpret visualizations", "https://developers.google.com/meridian/docs/post-modeling/interpret-visualizations"),
        ("Google Meridian source repository", "https://github.com/google/meridian"),
    ]
    s += [
        body(
            "아래 링크는 비교 기준으로 사용한 Google의 공식 문서와 공식 저장소입니다. Meridian 기능은 버전에 따라 바뀔 수 있으므로 실제 도입 시 최신 문서를 다시 확인하세요.",
            styles,
        )
    ]
    s += [source_item(title, url, styles) for title, url in sources]
    s += [
        Spacer(1, 4 * mm),
        callout(
            "문서 버전 메모",
            f"이 설명서는 MMM methodology {MODEL_VERSION}의 empirical-Bayes 조건부 Gaussian 근사, 채널별 profile 모델 평균, 실험/국가 prior, 반복 검증, 건강지표를 기준으로 작성되었습니다. 화면의 모델 버전과 설명서 발행일을 함께 보관하세요.",
            styles,
            "purple",
        ),
    ]
    return s


def english_story(styles: dict[str, ParagraphStyle]) -> list:
    s = cover_and_toc("en", styles)

    chapter(s, "1. What the model does - and does not do", styles)
    s += [
        heading("1.1 One-sentence definition", 2, styles),
        body(
            "The in-app MMM decomposes weekly KPI variation into natural demand, trend, seasonality, events, and media contributions. It estimates channel effect direction, uncertainty, and response curves while accounting for carryover and saturation, entirely in the browser.",
            styles,
        ),
        callout(
            "Essential distinction",
            "The model borrows selected ideas from Meridian, but it is not Meridian. It is a conditional Gaussian empirical-Bayes approximation with plug-in residual variance, Normal priors, and weak ridge regularization; it is not a fully hierarchical NUTS/MCMC model.",
            styles,
            "teal",
        ),
        heading("1.2 Questions it can support", 2, styles),
        bullets(
            [
                "Which channels show a positive relationship with a KPI after modeled trend, seasonality, 0/1 events, and regime steps, and how stable are the positive probability and 90% interval?",
                "Where is current spend on the response curve, and how much marginal response appears to remain?",
                "Does adding experimental or reference-country evidence improve held-out prediction, and how sensitive is the conclusion to that evidence?",
                "Which modeled drivers account for weekly KPI movement after trend, seasonality, and events are separated?",
                "How do conclusions change when the same media inputs are evaluated against any of five mapped KPIs?",
            ],
            styles,
        ),
        heading("1.3 Questions it must not claim to answer", 2, styles),
        bullets(
            [
                "It cannot prove a channel's pure incrementality from observational data alone. Simultaneous movement and omitted confounders can make individual channels unidentified.",
                "A low positive probability is not proof of zero effect; it can be lack of information.",
                "The budget response is not a binding plan when auctions, inventory, contracts, or creative quality change.",
                "A reference-country coefficient is not transferable merely because a column name matches.",
                "High in-sample R2 does not establish causal validity.",
            ],
            styles,
        ),
        heading("1.4 Decision-use levels", 2, styles),
        data_table(
            ["Level", "Conditions", "Appropriate use", "Required wording"],
            [
                ["Exploratory", "Observational only; identification warnings", "Prioritize experiments and data fixes", "Provisional association-based result"],
                ["Evidence-adjusted", "Prior applied; evidence-specific checks pass", "Ranged scenarios and channel comparison", "Disclose prior and validation"],
                ["Decision support", "Experiment aligns; base OOS and health are sound", "Incremental budget changes with measurement", "Supporting evidence, not causal proof"],
            ],
            [25, 49, 54, 46],
            styles,
        ),
    ]

    chapter(s, "2. Quick start: from upload to presentation", styles)
    s += [
        heading("2.1 Ten-step workflow", 2, styles),
        bullets(
            [
                "Prepare date, channel spend, KPI, and 0/1 event/regime columns in one CSV.",
                "Upload daily data directly; the app groups it into Monday-start weeks.",
                "Map whichever of Traffic, Registrations, Reactivations, Revenue, and Purchasers are available.",
                "Classify media as Performance or Brand and verify 0/1 event/regime columns.",
                "Run the no-prior base model first.",
                "Review predictive accuracy, interval coverage, residual autocorrelation, and negative natural demand.",
                "If experimental data exists, use Auto detection or explicitly select On/Off or Geo and generate a prior.",
                "If country panels exist, review eligible countries and the rolling 12-week recommendation.",
                "Toggle priors on and off for the same KPI to assess sensitivity.",
                "Present the data scope, model version, prior source, validation, and limitations together.",
            ],
            styles,
            numbered=True,
        ),
        heading("2.2 Data-length guidance", 2, styles),
        data_table(
            ["State", "Suggested weeks", "Use"],
            [
                ["Operational recommendation", "104+", "Best support for two-year seasonality, spend variation, and repeated validation"],
                ["Analyzable", "52-103", "Model can run; budget action still requires identification gates"],
                ["App low-information", "Under 52", "Exploratory effects only; budget guidance is blocked"],
                ["Very short", "Under 24", "Hard to separate time structure, saturation, and media"],
            ],
            [37, 44, 93],
            styles,
        ),
        callout(
            "More rows are not automatically more informative",
            "A shorter period with separable channel movements can identify more than a long period in which every channel follows the same budget pattern.",
            styles,
            "amber",
        ),
        heading("2.3 Sixty-second preflight", 2, styles),
        bullets(
            [
                "Is the KPI summable by week? Do not mix cumulative or cohort-window metrics into calendar-week outcomes.",
                "Do spend and KPI share geography, currency, time zone, and conversion window?",
                "Do target, experiment, and country-prior files map the same channel names?",
                "Are supported promotions, outages, and holidays encoded as exact 0/1 events or regime steps, and is the inability to map arbitrary continuous price/competition controls disclosed?",
                "Are any channels always switched on and off together?",
            ],
            styles,
        ),
    ]

    chapter(s, "3. MMM CSV input specification", styles)
    s += [
        heading("3.1 Meaning of one row", 2, styles),
        body(
            "A row can be a day or a week. Daily dates are automatically assigned to a Monday-start week and aggregated. A pre-aggregated weekly file can use its existing week identifier. With no time column, row-order t is allowed only after the user explicitly confirms that the file already contains one row per week ordered oldest to newest. Do not mix daily and weekly rows in one file.",
            styles,
        ),
        heading("3.2 Field dictionary", 2, styles),
        data_table(
            ["Role", "Example header", "Required", "Weekly rule", "Caution"],
            [
                ["Date/week", "date or week", "One, or confirm row order", "Daily rows map to Monday", "ISO date/week preferred"],
                ["Country", "country", "Optional / required for market prior", "Split by country", "Exactly one target code"],
                ["Platform/segment", "platform", "Optional", "Split or aggregate Total", "Keep Android/iOS definitions fixed"],
                ["Media spend", "meta_spend", "One or more", "Sum", "Non-negative; same currency"],
                ["Traffic", "traffic, sessions", "Optional Y", "Sum", "May be Reg + React if appropriate"],
                ["Registrations", "registrations", "Optional Y", "Sum", "Stable deduplication"],
                ["Reactivations", "reactivations", "Optional Y", "Sum", "Stable reactivation definition"],
                ["Revenue", "revenue", "Optional Y", "Sum", "Currency/refund policy fixed"],
                ["Purchasers", "purchasers", "Optional Y", "Sum", "Weekly unique preferred"],
                ["Event/regime flag", "holiday, promo", "Optional", "Occurred in week / step", "Only numeric or recognized binary 0/1"],
            ],
            [25, 38, 22, 36, 53],
            styles,
        ),
        body(
            "Numeric inputs accept thousands separators, scientific notation, and explicit magnitude suffixes (K/M/B and Korean 천/만/백만/억). For example, 1.2M becomes 1,200,000 and 3억원 becomes 300,000,000. Ambiguous suffixes such as 1.2MB are rejected rather than silently becoming 1.2. Five-digit Excel date serials use the same 1900-system UTC conversion in the main MMM, experiment, and country-prior paths. A row-segmented platform file must map date or week so rows for the same period can be combined; row-order confirmation alone is not allowed.",
            styles,
        ),
        heading("3.3 Multiple KPI mapping", 2, styles),
        body(
            "Only available, mapped targets become active. After analysis, the sticky target selector switches among Traffic, Registrations, Reactivations, Revenue, and Purchasers while retaining the same media/event/regime structure. If Traffic is absent but both Registrations and Reactivations are present, their sum can occupy the Traffic slot when the business definition permits it; the same derived value is not exposed again as a sixth RR/Total target.",
            styles,
        ),
        callout(
            "When the number of Y columns differs",
            "A KPI that exists in the target MMM file but is not mapped in the experiment or country-prior file receives no prior. That target remains a base observational model and must be labeled as such.",
            styles,
            "amber",
        ),
        heading("3.4 Matching rules", 2, styles),
        bullets(
            [
                "To calibrate target meta_spend, map the prior file's corresponding channel to meta_spend as well.",
                "Do not trust automatic linking when case, whitespace, or prefixes differ; verify the mapper. Unicode headers use stable name-based internal keys, but semantic equivalence still requires human review.",
                "KPI mappings require the same business definition, not merely the same header.",
                "Align currency and KPI scale before transferring coefficients across countries.",
            ],
            styles,
        ),
        heading("3.5 Platform splits", 2, styles),
        body(
            "Map a platform column or Android/iOS-tagged columns to switch between Total and platform-specific results. Total sums KPI and spend for the same week; Android and iOS are fitted as separate Y models. A large platform difference is not automatically pooled or borrowed across operating systems. Verify audience, pricing, and measurement-window differences and report separate conclusions when needed.",
            styles,
        ),
        callout(
            "Experiment priors stay at the same platform grain",
            "An Android or iOS result requires experiment rows for that same platform or an explicitly mapped Y tagged to that platform. Total sums every mapped platform Y, but a row is excluded when any required component Y is missing. The app never substitutes Total or another OS for the selected platform.",
            styles,
            "amber",
        ),
        heading("3.6 Long-format input", 2, styles),
        body(
            "The app also accepts week/date | channel | spend | Y. Channel rows for the same period and segment must repeat the identical total Y and event/regime values; only spend varies by channel. Spend is pivoted into wide media columns, while repeated Y is never summed. Blank time/channel rows and conflicting repeated Y/event values block analysis instead of being silently dropped or resolved by taking the first row. Reversing source-row order therefore produces the same result or the same blocking diagnostic.",
            styles,
        ),
    ]

    chapter(s, "4. Daily-to-weekly preprocessing", styles)
    s += [
        heading("4.1 Monday-start weeks", 2, styles),
        body(
            "Every date is assigned to the Monday that starts its calendar week. Rows through Sunday are grouped and ordered in time. Weekly modeling avoids treating day-level noise as if it were longer advertising carryover.",
            styles,
        ),
        formula(
            [
                "week_start(d) = Monday of the calendar week containing date d",
                "weekly_spend[w] = sum(spend[d]) for d in week w",
                "weekly_kpi[w]   = sum(kpi[d]) for d in week w",
                "weekly_event[w] = 1 if any event[d] = 1 in week w, else 0",
            ],
            styles,
        ),
        heading("4.2 Sums versus occurrence", 2, styles),
        body(
            "Spend, traffic, registrations, reactivations, revenue, and purchasers are flows and are summed. Binary holidays, promotions, and outages represent whether an event occurred in the week. Event and regime columns must be exactly numeric or recognized binary 0/1; a blank or another number blocks analysis rather than silently becoming zero. Three event days do not automatically imply an effect three times larger.",
            styles,
        ),
        heading("4.3 Missing values and partial weeks", 2, styles),
        data_table(
            ["Issue", "App behavior", "Operator action"],
            [
                ["Invalid/blank date", "Drop row and raise a blocking issue", "Fix source date"],
                ["Duplicate date/week", "Block at the same platform grain", "Resolve grain and deduplicate"],
                ["Missing week", "Block on a calendar gap", "Add actual KPI/spend row"],
                ["Internal partial week", "Block below modal 5/7-day cadence", "Recover missing days"],
                ["First/last partial", "Exclude with a warning", "Confirm complete-week scope"],
                ["Blank spend/KPI", "Do not silently sum as zero; block selected Y/channel", "Use 0 only for verified no-spend"],
                ["Negative media spend", "Block analysis", "Resolve refunds/corrections under the source definition"],
                ["Event/step not binary 0/1", "Block analysis", "Correct the binary value; never fill a blank silently with zero"],
                ["Rate KPI", "No automatic repair", "Redefine from numerator/denominator"],
            ],
            [41, 75, 58],
            styles,
        ),
        callout(
            "What weekly aggregation cannot fix",
            "It does not solve channel collinearity, omitted confounders, or inconsistent measurement. It only aligns time grain and reduces daily noise. The app does not directly map arbitrary continuous price or competition controls. Encode a defensible change as a 0/1 event or regime step when appropriate; otherwise disclose the omitted factor as a limitation.",
            styles,
            "red",
        ),
    ]

    chapter(s, "5. Model architecture", styles)
    s += [
        heading("5.1 Outcome equation", 2, styles),
        body(
            "Each KPI is fitted separately. Natural-demand level and trend, seasonality, events/regime changes, and transformed media features add up to the modeled weekly KPI.",
            styles,
        ),
        formula(
            [
                "y[t] = intercept + trend[t] + seasonality[t] + events[t]",
                "       + sum_m beta[m] * Hill(Adstock(spend[m,t])) + error[t]",
                "error[t] ~ Normal(0, sigma^2)",
            ],
            styles,
        ),
        heading("5.2 Non-media components", 2, styles),
        data_table(
            ["Component", "Role", "Interpretation caution"],
            [
                ["Trend", "Intercept plus long-run direction", "Not identical to all organic demand"],
                ["Seasonality", "Fourier cycles for configured periods", "Irregular events need explicit columns"],
                ["Holidays & Events", "Known shocks", "Future events require scenario values"],
                ["Regime change", "Step changes in product/measurement/policy", "Needs a defensible change date"],
                ["Performance / Brand", "Reported media contribution groups", "Group totals do not ensure channel identification"],
            ],
            [37, 66, 71],
            styles,
        ),
        body(
            "The default seasonality grid is annual 52.18 weeks and quarterly 13.04 weeks, with one sine/cosine pair for each period. The app does not automatically create separate monthly, weekday, or country-calendar effects.",
            styles,
        ),
        callout(
            "No automatic local calendar or arbitrary steps",
            "The model does not hard-code Korean holiday weeks or insert arbitrary steps at week 42/55. It uses only event and regime columns mapped by the user. A collinear step is not silently deleted; it is surfaced in diagnostics so the analyst can retain, combine, or remove it based on the real change event.",
            styles,
            "teal",
        ),
        heading("5.3 Standardization and back-transformation", 2, styles),
        body(
            "Features are centered and scaled for numerical stability, then coefficients and contributions are returned to the original transformed-feature and KPI units. Calibrated-prior precision is transformed consistently, so changing revenue units from currency units to thousands does not arbitrarily change relative prior strength.",
            styles,
        ),
        formula(
            [
                "z[j,t] = (x[j,t] - mean(x[j])) / sd(x[j])",
                "beta_raw[j] = beta_standardized[j] / sd(x[j])",
                "Var(beta_standardized prior) = Var(beta_raw prior) * sd(x[j])^2",
            ],
            styles,
        ),
        heading("5.4 Collinearity", 2, styles),
        body(
            "When two channels move together at nearly a fixed ratio, the model may explain their combined movement but cannot reliably separate them. A prior adds information; it must not disguise non-identification. Aggregate channels, obtain more varied periods, or run a holdout/geo experiment.",
            styles,
        ),
    ]

    chapter(s, "6. Empirical-Bayes inference", styles)
    s += [
        heading("6.1 Conditional Gaussian analytical approximation", 2, styles),
        body(
            "The app does not draw thousands of posterior samples. It plug-in estimates residual variance sigma², then conditions on that value while combining a linear Gaussian likelihood with Normal priors and weak ridge penalties. Coefficient means and covariance are solved by matrix algebra. This is an empirical-Bayes analytical approximation, not a Student-t posterior integrating sigma² or a fully hierarchical joint posterior. Results are deterministic for the same input and fast enough for in-browser use.",
            styles,
        ),
        formula(
            [
                "Likelihood: y | beta ~ Normal(X beta, sigma^2 I)",
                "Calibrated prior: beta[j] ~ Normal(mu[j], v[j])",
                "Posterior precision = X'X / sigma^2 + prior_precision",
                "Posterior mean = inverse(Posterior precision) * (X'y / sigma^2 + prior_precision * mu)",
            ],
            styles,
        ),
        heading("6.2 Weak regularization and calibrated priors", 2, styles),
        body(
            "Coefficients without external evidence receive weak ridge regularization. Media coefficients with experimental or country evidence receive an actual Normal(mean, variance) precision. Residual scale is plug-in estimated and the prior penalty is fixed-point updated so that KPI unit changes do not distort the prior-data balance. Uncertainty in sigma² itself is not integrated.",
            styles,
        ),
        heading("6.3 Positive probability and the 90% interval", 2, styles),
        body(
            "A prior-locked channel uses its conditional Gaussian coefficient mean and standard deviation for positive probability and its 90% interval. For a no-prior channel, transform-candidate probabilities are BIC-weighted and the 90% effect interval directly inverts the weighted Gaussian-mixture CDF at 5% and 95%, preserving asymmetry or separated candidate conclusions instead of replacing the mixture with a Normal approximation.",
            styles,
        ),
        formula(
            [
                "F_mix(x) = sum_k weight[k] * Phi((x - mean[k]) / sd[k])",
                "CI90 = [inverse_F_mix(0.05), inverse_F_mix(0.95)]",
            ],
            styles,
        ),
        callout(
            "No sampling diagnostics",
            "Because there are no MCMC chains, R-hat, effective sample size, and trace plots cannot be computed. The product reports them as not applicable rather than manufacturing substitutes.",
            styles,
            "amber",
        ),
        heading("6.4 Trade-offs", 2, styles),
        data_table(
            ["Benefit", "Trade-off"],
            [
                ["Fast, deterministic browser execution", "No fully sampled nonlinear/hierarchical joint posterior"],
                ["Explicit prior mean and variance", "Prior does not repair misspecification or collinearity"],
                ["Fast switching across KPIs", "KPIs are separate models, not a multivariate outcome"],
                ["No server upload", "Large geo panels and huge candidate sets exceed browser comfort"],
            ],
            [73, 101],
            styles,
        ),
    ]

    chapter(s, "7. Carryover, saturation, and model averaging", styles)
    s += [
        heading("7.1 Geometric adstock", 2, styles),
        body(
            "A fraction alpha of the previous media state carries into the next week. Higher alpha implies longer carryover. For Geo experiments, state is computed independently within each geo so the last week of one geo never leaks into the first week of another.",
            styles,
        ),
        formula("adstock[t] = spend[t] + alpha * adstock[t-1],  0 <= alpha < 1", styles),
        heading("7.2 Hill saturation", 2, styles),
        body(
            "The half-saturation ec is the adstock level at half of the normalized maximum response; slope controls curvature. It represents diminishing marginal response as exposure grows.",
            styles,
        ),
        formula("hill(a; ec, slope) = a^slope / (a^slope + ec^slope)", styles),
        heading("7.3 Representative transform", 2, styles),
        body(
            "The engine compares alpha x ec x slope candidates for every channel. The fixed grids are alpha = 0.0, 0.1, ..., 0.8; ec = the 40th, 60th, and 80th percentiles of that channel's positive adstock distribution; and slope = 0.6, 0.8, 1.0, 1.4. It selects a representative transform by the magnitude of its relationship with KPI residuals after trend, seasonality, 0/1 events, and regime steps; coefficient inference determines the sign later. That set drives decomposition and forecast. Profile-fit budget is 48 per channel and 480 total without priors, or 240 total when any external prior exists, divided evenly across no-prior channels that still require profiling.",
            styles,
        ),
        heading("7.4 One-channel-at-a-time profile averaging", 2, styles),
        body(
            "For channels without priors, effect probability, intervals, response curves, and budget guidance do not rely on only the representative transform. That channel's candidates are refitted while other channels stay at their representatives, and BIC differences determine weights. On/Off intensity uses the target representative alpha/ec/slope. A Geo effect is first divided by its linear-adstock DiD effect and then converted to the target coefficient unit with the Hill derivative at the overlapping national target-adstock operating point. Each reference market is refitted with the same target parameters. A channel with external evidence is therefore locked to the target representative transform, and the same prior numbers are never reused under a different transform.",
            styles,
        ),
        formula(
            [
                "weight[k] proportional to exp(-0.5 * (BIC[k] - min(BIC)))",
                "mean_mix = sum_k weight[k] * mean[k]",
                "var_mix  = sum_k weight[k] * (sd[k]^2 + mean[k]^2) - mean_mix^2",
                "effective_candidates = 1 / sum_k weight[k]^2",
            ],
            styles,
        ),
        callout(
            "Scope of averaging",
            "This is not a Cartesian product over every channel's transform and not a joint Bayesian model average. It is a one-channel-at-a-time profile average; cross-channel transform interactions remain approximate.",
            styles,
            "red",
        ),
        heading("7.5 Steady-state response curves", 2, styles),
        body(
            "The response-curve x-axis is a sustainable weekly spend level, not a single-week pulse. Each candidate therefore uses steady-state adstock = spend/(1-alpha). Changing alpha changes accumulated exposure and marginal response at the same weekly spend.",
            styles,
        ),
    ]

    chapter(s, "8. Experimental priors: On/Off and Geo", styles)
    s += [
        heading("8.1 Why raw test data is useful", 2, styles),
        body(
            "Raw experiment periods allow the app to estimate effect size and uncertainty from the same design. On/Off divides the KPI treatment effect by the treatment effect on exposure transformed with the target alpha, ec, and slope. Geo does not apply nonlinear Hill separately within each geo and then aggregate it. It first divides the KPI DiD by the geo-level linear-adstock DiD, then converts that return into the target coefficient unit with the Hill derivative at the national target-adstock operating point shared by the experiment and target periods. Cross-equation covariance, the delta method, a bounded Fieller ratio interval, and jackknife uncertainty are all propagated.",
            styles,
        ),
        formula(
            [
                "On/Off prior_mean = effect_KPI / effect_Hill(adstock)",
                "Geo r_A = DiD_effect_KPI / DiD_effect_geo_adstock",
                "Geo prior_mean = r_A / Hill_derivative(target_overlap_adstock)",
                "Var(y/x) approximately Var(y)/x^2 + y^2 Var(x)/x^4",
                "                         - 2*y*Cov(y,x)/x^3",
                "require a bounded two-sided 90% Fieller ratio interval",
                "prior_variance = max(delta_variance * inflation^2, Fieller_equivalent_variance, jackknife_SE^2 * inflation^2)",
                "prior_precision = 1 / prior_variance",
            ],
            styles,
        ),
        heading("8.2 Experiment-type detection and accepted layouts", 2, styles),
        body(
            "The upload default is Auto. Auto first uses a type column when present, then looks for a Geo wide or Geo long schema, and otherwise falls back to On/Off. The type column must contain one interpretable file-wide value such as Geo or OnOff. If detection does not match the intended design, the Experiment type selector can force On/Off or Geo; this user choice overrides the type column and schema detection. The screen reports both the resolved type and its source.",
            styles,
        ),
        data_table(
            ["Layout", "Required columns", "Normalization"],
            [
                ["On/Off wide", "type (optional), time, state, KPI, tested channel spend", "Used as one row per week"],
                ["Geo long", "type (optional), time, period, geo, arm, KPI, tested channel spend", "Used as a geo x week panel"],
                ["Geo wide", "type (optional), time, period, target_geo, control_geo, paired target_/control_ KPI and spend", "Each row becomes treatment and control geo rows"],
                ["Long media", "time, channel, spend plus design fields and repeated KPI", "Pivots spend into headers matching the main MMM channels"],
            ],
            [33, 77, 64],
            styles,
        ),
        callout(
            "Rename template fields to the actual mappings",
            "The screen provides On/Off, Geo wide, and Geo long example CSV downloads. Replace registrations and meta_spend with the exact Y and channel headers mapped in the main MMM. A long-media channel value must also map to a main-MMM channel. If repeated KPI values disagree within the same time, geo, and platform, the app pauses instead of selecting the first row.",
            styles,
            "teal",
        ),
        heading("8.3 Building experiment weeks from daily rows", 2, styles),
        body(
            "When dates are parseable, daily experiment rows are grouped by geo x Monday-start week, or by Monday-start week when geo is absent. KPI and tested-channel spend are summed. Invalid-date rows are dropped; a boundary week with mixed state/arm/period and a week with any missing KPI or spend source row are excluded in full. The modal cadence classifies five- versus seven-day feeds. First/last partial weeks are removed, while an internal partial week, missing period, or duplicate weekly period pauses the prior so adstock time is never compressed.",
            styles,
        ),
        data_table(
            ["Diagnostic", "Meaning"],
            [
                ["source rows", "Raw uploaded row count"],
                ["usable weeks", "Geo-weeks/weeks retained for prior calculation"],
                ["unparseable date rows", "Rows excluded because the date could not be parsed"],
                ["mixed boundary weeks", "Weeks excluded because state/arm/period changed within the week"],
                ["missing weeks", "Weeks excluded because any source KPI/spend value was missing"],
                ["partial/gap diagnostics", "Boundary partial exclusions and blocking internal partial, missing-period, or duplicate-period reasons"],
            ],
            [58, 116],
            styles,
        ),
        callout(
            "Conservative exclusion is intentional",
            "A boundary week is not forced into ON or POST by majority vote. Source rows, usable weeks, and every exclusion count are retained so the prior sample is reproducible.",
            styles,
            "teal",
        ),
        body(
            "A platform-specific prior uses only same-platform rows or the corresponding Android/iOS-tagged mapped Y. Total sums all mapped platform Y values, and a row is excluded if any component Y is missing. Total or another OS is never borrowed for the selected platform prior.",
            styles,
        ),
        heading("8.4 On/Off schema", 2, styles),
        data_table(
            ["Column", "Meaning", "Example"],
            [
                ["time", "Date or week", "2026-01-05"],
                ["state", "ON/OFF state", "on, off"],
                ["channel spend", "Spend for the tested channel", "meta_spend"],
                ["KPI", "Same target definition", "registrations"],
            ],
            [36, 83, 55],
            styles,
        ),
        body(
            "Repeated ON-OFF-ON periods are required for useful state replication. The prior needs at least 16 validated weekly observations, at least four ON weeks, at least four OFF weeks, and at least two state transitions. A one-way switch or a 1-versus-15 split does not qualify. A state may be inferred only from verified observed spend zeros; missing spend is never treated as OFF. Time-series uncertainty uses HAC standard errors and a block jackknife. If HAC estimation fails, the app pauses instead of falling back to ordinary OLS standard errors. This converter does not regress on extra promotion or outage controls; disclose concurrent shocks separately.",
            styles,
        ),
        heading("8.5 Geo schema", 2, styles),
        data_table(
            ["Column", "Meaning", "Example"],
            [
                ["time", "Aligned observation week", "2026-W08"],
                ["geo", "Geographic unit", "Seoul, Busan"],
                ["arm", "Target/control", "treatment, control"],
                ["period", "Pre/post", "pre, post"],
                ["channel spend", "Geo-level tested spend", "search_spend"],
                ["KPI", "Geo-level outcome", "revenue"],
            ],
            [36, 83, 55],
            styles,
        ),
        body(
            "A Geo prior requires a comparable date/week column, at least 16 validated geo-week observations, at least four geos, and at least two geos in each treatment and control arm. Each geo's arm must remain fixed; every week must have one common pre/post state across geos; every geo must appear in both pre and post; and all four treatment/control x pre/post cells must exist. The app estimates treatment x post DiD with geo and week fixed effects against geo-level linear adstock. It does not fall back to OLS standard errors when cluster covariance fails, and LOCO is accepted only if every leave-one-geo-out fit succeeds. The two-sided 90% Fieller interval for the KPI/intensity ratio must be bounded. At least four experiment weeks must overlap target MMM weeks to define the national target-adstock Hill derivative; no overlap or a near-zero derivative pauses unit alignment.",
            styles,
        ),
        formula(
            [
                "inflation = max(1, t_critical(0.90, df) / 1.645)",
                "prior_variance = max(cluster_delta_variance * inflation^2, Fieller_equivalent_variance, LOCO_SE^2 * inflation^2)",
            ],
            styles,
        ),
        callout(
            "When multiple spend columns move in one holdout",
            "When the file has several spend columns, the app first checks which ones move materially with state/arm/period. Exactly one clear channel can proceed; two or more moving together remain a bundle that cannot identify channel-specific effects. Even the selected channel is paused when transformed-exposure contrast is not distinguishable from zero, preventing an unstable ratio prior.",
            styles,
            "red",
        ),
        heading("8.6 How the confidence interval controls strength", 2, styles),
        body(
            "The UI does not accept only a summarized CI. It estimates the effect/intensity ratio from period-level rows, including cross-equation covariance, robust delta variance, a two-sided 90% Fieller ratio interval, and block or LOCO jackknife uncertainty. An unbounded or disjoint Fieller interval does not produce a prior. For a bounded interval, the farther endpoint from the mean is divided by 1.645 to form a conservative symmetric Normal-variance candidate. The widest of robust delta, Fieller-equivalent, and jackknife uncertainty becomes the prior variance. Wider intervals therefore reduce precision and let MMM data update the prior more easily; there is no arbitrary strength slider.",
            styles,
        ),
        heading("8.7 Same-KPI/time reuse and transfer checks", 2, styles),
        callout(
            "Do not put the same outcome into both prior and likelihood",
            "Calendar overlap alone is not an automatic failure, but copying the same population's KPI values into both the experiment file and main MMM does not create independent evidence. For national On/Off, the app treats at least four comparable overlapping weeks with 95% or more numeric matches to the same-week main-MMM Y as outcome reuse and blocks the prior. If the two clocks themselves cannot be compared, such as calendar dates versus an unlabeled numeric index, the On/Off prior is also paused because reuse cannot be ruled out. Partial overlap and Geo evidence report the overlapping and exact-match week counts; the analyst must confirm that the effect came from separately identified treatment/control aggregation.",
            styles,
            "red",
        ),
        bullets(
            [
                "Do experiment and MMM share KPI definition, conversion window, currency, and population?",
                "Is test intensity within the MMM's observed range?",
                "Did price, promotion, product, or creative change at the same time?",
                "Do tested channel and target channel map to the same key?",
                "Has uncertainty from timing/population transfer been acknowledged?",
            ],
            styles,
        ),
        callout(
            "An experiment is not automatically a perfect prior",
            "Google's Meridian calibration guidance also notes that estimand, time, and population can differ between an experiment and an MMM. A narrow test interval should not be forced onto the full history without a transfer assessment.",
            styles,
            "amber",
        ),
    ]

    chapter(s, "9. Reference-country priors", styles)
    s += [
        heading("9.1 Purpose and schema", 2, styles),
        body(
            "Upload multiple reference countries in the same format as the target MMM to discover transferable channel evidence. The main MMM CSV must contain exactly one COUNTRY value, the reference CSV needs a COUNTRY column, and every reference country requires at least 24 valid weekly rows. If the target cannot be identified, all market priors are paused to prevent self-reference. Matching headers only establish a technical mapping; the user must verify business definition, units, and conversion windows.",
            styles,
        ),
        heading("9.2 Two-stage selection", 2, styles),
        bullets(
            [
                "Eligibility fits at most 12 reference countries after checking data sufficiency, overlapping media/KPI, timeline compatibility, and fit feasibility. Eligible countries remain individually visible.",
                "All eligible countries and later combinations use the same non-overlapping rolling-origin folds. This is more stable than one holdout, but reusing the folds for shortlisting and set selection does not remove selection bias and is not independent OOS.",
                "Only the top four countries on those common folds enter combinations of up to three countries and at most 24 sets.",
                "Selection considers fold instability, at least 2% improvement, fold win rate, whether paired-fold mean improvement exceeds one SE of its fold noise, country-count complexity, and a one-standard-error preference for a simpler set.",
                "No prior is the correct recommendation if the baseline wins or improvements are unstable.",
            ],
            styles,
        ),
        heading("9.3 Repeated 12-week validation", 2, styles),
        body(
            "The default moves a 12-week window backward in 12-week steps, producing up to three non-overlapping folds with at least 24 training weeks. Country-prior selection requires at least two folds, which typically needs 48 valid target weeks; three folds are preferred. A 36-47 week target yields only one fold, so the app retains the base even if that single score looks favorable. Actual target-country spend and supported 0/1 event/regime features are supplied while KPI values are hidden, and every candidate uses identical folds.",
            styles,
        ),
        body(
            "Candidate validation locks target Y scale and representative alpha/ec/slope once at the earliest training cutoff across all folds. Reference rows are also restricted to what existed by that cutoff, so later reference data and hidden target Y cannot enter candidate priors. Because market spend scales differ, each reference channel is multiplied so its positive-adstock median matches the earliest-cut target operating scale before fitting under the same target ec/Hill unit. A market is held if date, transform, or spend-scale alignment fails. Only after selection are the chosen references refit using reference history through the target's final period and full-target transforms/Y scale; reference rows after the target ends are excluded. That final refit has no separate independent OOS score.",
            styles,
        ),
        formula(
            [
                "spend_scale[m,c] = median_positive_adstock_target[m] / median_positive_adstock_reference[m,c]",
                "eligibility requires finite RMSE on every common fold",
                "mean_RMSE = mean(RMSE across all common folds)",
                "score = (mean_RMSE + 0.25 * sd_RMSE)",
                "        * (1 + 0.025 * max(0, number_of_countries - 1))",
            ],
            styles,
        ),
        heading("9.4 Between-country transfer heterogeneity", 2, styles),
        body(
            "With multiple references, a random-effects tau^2 represents between-country disagreement and the result is a predictive prior for a new target market. With one source, heterogeneity cannot be estimated, so posterior SD has a 50% relative floor. With multiple sources, the relative SD floor is 25%; tau^2 and a within-country precision floor are also retained.",
            styles,
        ),
        formula(
            [
                "relative_floor = 0.50 if K = 1, else 0.25",
                "relative_var_floor = (relative_floor * max(|pooled_mean|, sqrt(median(within_var))))^2",
                "precision_floor_var = median(within_var) / max_effective_countries  (max = 3)",
                "predictive_var = tau^2 + max(pooled_mean_var, precision_floor_var, relative_var_floor)",
                "transfer_precision = 1 / predictive_var",
            ],
            styles,
        ),
        callout(
            "Uploading 47 countries does not mean using 47",
            "Only a small, stable set that improves target prediction should survive. More countries do not automatically score better; complexity and cross-country heterogeneity suppress overconfident pooling.",
            styles,
            "teal",
        ),
        heading("9.5 Interpretation boundary", 2, styles),
        body(
            "Country rolling folds ask whether a country-only prior repeatedly improves hidden 12-week target prediction over the base. Target transforms, Y scale, and reference evidence are locked at the earliest cutoff, preventing later-information leakage. However, the same folds are reused to shortlist markets and select combinations, so they remain candidate-tuning data rather than final independent OOS. After selection, chosen references are refit on full history and combined only in the final model with experiment evidence estimated under a separate design. If experiment and MMM share outcome records, the same-KPI reuse boundary reported by experiment diagnostics still applies. Predictive gain is not proof of causal transportability.",
            styles,
        ),
    ]

    chapter(s, "10. Validation and model health", styles)
    s += [
        heading("10.1 Three layers", 2, styles),
        data_table(
            ["Layer", "Question", "Metrics"],
            [
                ["Fit", "How well does the model describe observed history?", "R2, RMSE, wMAPE"],
                ["Prediction", "How well does it predict hidden future periods?", "Last-20% OOS for the no-external-prior base; earliest-cut as-of 12-week country tuning"],
                ["Identification/health", "Could it be right for the wrong reason?", "Coverage, residual ACF1, negative baseline, prior shift"],
            ],
            [34, 76, 64],
            styles,
        ),
        heading("10.2 General OOS backtest", 2, styles),
        body(
            "With at least 48 weeks, the final 20% base OOS is shown only when no external prior is active. Transform parameters are selected within training data and actual held-out media spend is used for forward prediction. With external evidence active, this base-only score is disabled so it is not mistaken for an independent score of the prior model. Experiment priors use their own effect CI, Fieller, HAC/cluster, and jackknife diagnostics; country priors use country-only versus base rolling 12-week candidate tuning locked to earliest-cut target transforms/Y/reference evidence. Both sources are precision-combined only in the final all-history fit.",
            styles,
        ),
        heading("10.3 Health metrics", 2, styles),
        data_table(
            ["Metric", "Meaning", "Warning", "Action"],
            [
                ["wMAPE", "Absolute errors / absolute actuals", "Worse than baseline", "Review events/regimes/transforms/prior"],
                ["90% coverage", "Actual inside predicted 90% interval", "Too low or nearly 100%", "Check under/over-dispersion"],
                ["Residual ACF1", "Adjacent residual correlation", "Absolute value >= 0.3", "Check time structure"],
                ["Negative baseline", "Weeks with natural demand below zero", "Any positive share", "Suspect misspecification"],
                ["Prior shift", "Posterior-prior gap in prior SDs", "Absolute value > 2", "Review transportability"],
                ["Top weight", "Weight on the leading transform", "Low with many effective candidates", "Treat shape as uncertain"],
            ],
            [33, 55, 43, 43],
            styles,
        ),
        heading("10.4 Prediction is not causality", 2, styles),
        body(
            "A high R2 can coexist with confounded channel coefficients when a price change or another driver is omitted. The app cannot directly map a continuous price control; encode a defensible change point as a 0/1 event/step when appropriate and disclose the rest as a limitation. Conversely, a market with little media variation can yield wide channel intervals even if media truly works. Combine predictive validation, identification review, and external experiments.",
            styles,
        ),
        callout(
            "Why there is no R-hat",
            "Meridian diagnoses MCMC chain convergence with R-hat and traces. This analytical model has no chains, so it uses predictive, residual, baseline, and prior-conflict checks instead.",
            styles,
            "purple",
        ),
    ]

    chapter(s, "11. Interpreting the results", styles)
    s += [
        heading("11.1 Weekly contribution decomposition", 2, styles),
        body(
            "The stacked decomposition uses one representative transform set. Trend includes the intercept/natural-demand level and its long-run direction. Seasonality, Events, Regime change, Performance, and Brand add to the fitted KPI; residual is actual minus fitted.",
            styles,
        ),
        formula("actual[t] = sum(group_contribution[g,t]) + residual[t]", styles),
        heading("11.2 Contribution-magnitude share", 2, styles),
        body(
            "The driver share is each group's mean squared weekly contribution normalized across groups. It is a diagnostic for which groups moved the model most. It is not Shapley R2, incremental revenue share, or total contribution share.",
            styles,
        ),
        formula(
            [
                "magnitude[g] = mean(contribution[g,t]^2)",
                "share[g] = magnitude[g] / sum_h magnitude[h]",
            ],
            styles,
        ),
        heading("11.3 Channel-effect card", 2, styles),
        data_table(
            ["Field", "Meaning"],
            [
                ["Mean effect", "KPI coefficient per unit of transformed media feature"],
                ["90% interval", "Conditional Gaussian for prior-locked channels; 5%/95% mixture-CDF quantiles otherwise"],
                ["Positive probability", "BIC-weighted candidate Gaussian probabilities"],
                ["Candidate count", "One for a unit-locked prior channel; fitted profile count for a no-prior channel"],
                ["Effective candidates", "How broadly weights are distributed; near 1 means one dominates"],
                ["Top candidate weight", "Largest BIC weight; low values signal transform ambiguity"],
                ["Current marginal", "Response change and 90% interval for a fixed source-currency increment (KRW 1M or USD 1k); the display-currency toggle changes formatting only"],
            ],
            [52, 122],
            styles,
        ),
        heading("11.4 Prior toggle", 2, styles),
        body(
            "Compare with-prior and without-prior for the same KPI. Look beyond a mean shift: inspect the 90% interval, positive probability, and prior shift, and check that the interval does not become implausibly narrow. Base OOS is available only without external priors, not as an equivalent independent score for the prior model. Experiment Fieller/CI identification and earliest-cut as-of country tuning are labeled separately. If a conclusion depends completely on one prior, that sensitivity belongs in the presentation.",
            styles,
        ),
        callout(
            "Use ranges, not forced rankings",
            "If a channel's current-marginal 90% interval overlaps the leading channel's interval, the app returns a candidate group rather than a single winner. Treat both as candidates and use an experiment to distinguish them.",
            styles,
            "amber",
        ),
    ]

    chapter(s, "12. Response curves, budget guidance, and forecasts", styles)
    s += [
        heading("12.1 Response curves", 2, styles),
        body(
            "A no-prior channel curve is the BIC-weighted response across profile candidates; a prior channel uses its unit-locked representative transform. The x-axis is sustainable weekly spend and the y-axis is modeled media response. Compare recent spend with the curve to assess saturation and remaining marginal response.",
            styles,
        ),
        heading("12.2 Budget use", 2, styles),
        bullets(
            [
                "Prefer measurement over a large increase when the effect interval is broad or positive probability is weak.",
                "The marginal increment is fixed in source currency at KRW 1 million or USD 1 thousand; changing display currency does not change the calculation.",
                "Convert sustained post-increment spend to steady-state adstock for each profile candidate. If it exceeds the historical adstock maximum for any candidate in the leading cumulative 95% BIC weight, label extrapolation and exclude it from budget guidance.",
                "Group channels whose marginal 90% intervals overlap the leader; do not force a single rank.",
                "Add auction learning, inventory, contracts, creative, and Brand/Performance lag as external constraints.",
                "Refit after the budget change and confirm incrementality with a holdout where possible.",
            ],
            styles,
        ),
        heading("12.3 Budget-action identification gates", 2, styles),
        body(
            "If any gate below fails, the app can still show exploratory direction but blocks direct increase/decrease guidance. Budget action requires both overall model identification and channel-level spend history, effect evidence, and a positive current marginal interval.",
            styles,
        ),
        data_table(
            ["Gate", "Block when", "Meaning"],
            [
                ["History", "Fewer than 52 weeks", "App low-information region"],
                ["Observations/parameters", "weeks / estimated parameters < 8", "Too little information per degree of freedom"],
                ["VIF", "Any media-variable VIF >= 10", "Individual effects unstable under multicollinearity"],
                ["Media-related correlation", "Any media-media or media-nonmedia explanatory pair |corr| >= 0.90", "Channel budget actions cannot be separated"],
                ["Active weeks", "Fewer than 20 weeks with spend > 0", "Insufficient channel-specific variation"],
                ["Spend variation", "Spend is constant across history", "Response and marginal effect are unidentified"],
                ["Recent activity", "Spend is zero in all of the last 8 weeks", "Not connected to a current budget action"],
                ["Effect evidence", "Channel P(effect > 0) < 0.80", "Insufficient probability support for an increase"],
                ["Marginal interval", "90% lower bound for the fixed increment <= 0", "Positive response to the next increment is uncertain"],
                ["Transformed observed range", "Post-increment steady-state adstock exceeds the historical adstock maximum for any profile in the leading cumulative 95% BIC weight", "Catch flight-channel extrapolation and exclude from guidance"],
            ],
            [43, 57, 74],
            styles,
        ),
        heading("12.4 Forecast mechanics", 2, styles),
        body(
            "Future spend scenarios advance adstock state sequentially. Trend and Fourier features advance to the future week; structural steps retain the last known state. Future holidays/events require explicit scenario inputs, otherwise the baseline scenario treats unknown events as zero.",
            styles,
        ),
        heading("12.5 Predictive interval", 2, styles),
        body(
            "The predictive interval includes residual variance and coefficient uncertainty for the future design row, x'Cov(beta)x. Long horizons and out-of-range scenarios require an additional model-risk warning.",
            styles,
        ),
        formula("predictive_var(x*) = sigma^2 * (1 + x*' (X'X + penalty)^-1 x*)", styles),
        callout(
            "Forecasts are conditional scenarios",
            "They assume planned spend occurs and that pricing, product, competition, and measurement remain consistent with the model. They are not guaranteed revenue commitments.",
            styles,
            "red",
        ),
    ]

    chapter(s, "13. Working across KPIs", styles)
    s += [
        heading("13.1 Sticky target selector", 2, styles),
        body(
            "Mapped KPIs are active in the sticky selector. Switching the target loads that Y's fit, priors, validation, and response curves under the same input structure. Coefficient scale and identification differ by KPI; never copy a conclusion from one target to another.",
            styles,
        ),
        heading("13.2 Funnel interpretation", 2, styles),
        data_table(
            ["Target", "Primary question", "Caution"],
            [
                ["Traffic", "Which channels move top-funnel volume?", "Check overlap if built from Reg + React"],
                ["Registrations", "Which channels move new acquisition?", "Stable deduplication/window"],
                ["Reactivations", "Which channels move returning users?", "Retargeting vs natural return"],
                ["Purchasers", "Which channels move buyer count?", "Weekly unique definition"],
                ["Revenue", "Which channels move value?", "Fix price/refund definitions; promotion enters only as an exact 0/1 event"],
            ],
            [34, 74, 66],
            styles,
        ),
        heading("13.3 KPI-prior coverage", 2, styles),
        body(
            "Review the channel x KPI prior map. If an experiment contains Registrations only while the MMM also has Reactivations and Revenue, only the Registrations model receives that experiment prior. Country priors follow the same rule; unmatched targets show 'no prior'.",
            styles,
        ),
    ]

    chapter(s, "14. Comparison with Google Meridian", styles)
    s += [
        heading("14.1 Side-by-side", 2, styles),
        data_table(
            ["Area", "This app", "Google Meridian"],
            [
                ["Execution", "Browser memory; no CSV server upload", "Python package; local/cloud compute"],
                ["Inference", "Plug-in sigma² empirical-Bayes conditional Gaussian approximation", "NUTS MCMC posterior sampling"],
                ["Spatial structure", "One target + optional country coefficient priors", "Hierarchical geo random coefficients or national"],
                ["Media data", "Weekly spend-based features", "Media execution + spend; reach/frequency support"],
                ["Carryover/saturation", "Geometric adstock + Hill; no-prior profile averaging, prior transform lock", "HillAdstock with configurable lag/adstock"],
                ["Prior types", "Normal coefficient prior from experiments/countries", "ROI, mROI, contribution, coefficient priors"],
                ["Time baseline", "Trend, Fourier seasonality, events, steps", "Knot-based time-varying intercept + controls"],
                ["Uncertainty", "Sigma²-conditional Gaussian + per-channel profile-mixture CDF", "Joint posterior samples across parameters"],
                ["Validation", "Base-only 20% OOS; earliest-cut as-of country tuning; experiment Fieller/CI; fit/coverage/ACF/baseline/prior shift", "holdout_id, model fit, posterior predictive and MCMC diagnostics"],
                ["Sampling health", "R-hat/ESS/trace not applicable", "R-hat, trace, ESS"],
                ["Repeatability", "Deterministic for identical input", "Sampling variation managed by chains/seeds"],
                ["Scale", "Fast marketer-facing multi-KPI UX", "Compute-intensive; GPU can be recommended"],
            ],
            [33, 70, 71],
            styles,
        ),
        heading("14.2 Difference from the broader fully Bayesian MMM family", 2, styles),
        data_table(
            ["Area", "This app", "Fully Bayesian MMM family"],
            [
                ["Residual variance", "Plug-in fixed-point sigma²", "Can assign priors to and integrate sigma²/error distribution"],
                ["Nonlinear parameters", "Per-channel profile candidates + BIC weights", "Can jointly infer adstock, saturation, and coefficients"],
                ["Hierarchy", "Transfers country effects as external priors", "Can partially pool geo/channel coefficients inside one model"],
                ["Compute", "Deterministic matrix algebra", "MCMC, VI, SMC, or related probabilistic inference"],
                ["Diagnostics", "Prediction, residual, identification, prior shift", "Those plus chain convergence, ESS, posterior predictive checks"],
            ],
            [38, 69, 75],
            styles,
        ),
        body(
            "Calling this app simply non-Bayesian would be misleading, but calling it equivalent to Meridian or a fully Bayesian hierarchical MMM would also overstate it. The precise description is a conditional Gaussian empirical-Bayes MMM that applies Normal priors with explicit variances.",
            styles,
        ),
        heading("14.3 Meridian principles adopted", 2, styles),
        bullets(
            [
                "Separate carryover from saturation.",
                "Treat a prior as a probability distribution with mean and variance, not a manual weight.",
                "Use experimental point estimates and standard errors as calibration evidence.",
                "Separate in-sample fit from holdout prediction; inspect prior-posterior conflict and baseline pathologies.",
                "State that predictive accuracy does not establish causal validity.",
            ],
            styles,
        ),
        heading("14.4 Not currently implemented", 2, styles),
        data_table(
            ["Capability", "Why/impact", "Use when"],
            [
                ["NUTS/MCMC", "Browser compute and latency; no fully sampled joint posterior", "Run Meridian in Python/local compute"],
                ["Hierarchical geo effects", "Country priors transfer coefficients; they are not partial pooling", "Rich geo panels and population data"],
                ["Reach/frequency", "Current mapping is spend-centered", "High-quality R/F data exists"],
                ["ROI/mROI priors", "Current prior targets transformed-feature coefficients", "Cost, revenue, and estimands are rigorously aligned"],
                ["Knot baseline", "Current trend/Fourier/step structure", "Long nonlinear baselines with enough history"],
                ["Joint transform average", "Per-channel profile limits compute", "Offline MCMC/SMC or bounded joint search"],
                ["Posterior predictive sampling", "Uses a conditional Normal predictive reference interval", "Asymmetry/heavy tails are material"],
            ],
            [41, 88, 45],
            styles,
        ),
        callout(
            "Which is better?",
            "This app favors fast, private, browser-based, multi-KPI analysis. Meridian is more appropriate when geo partial pooling, reach/frequency, a joint posterior, and standard MCMC diagnostics are essential. The choice is about architecture and purpose, not a universal accuracy rank.",
            styles,
            "purple",
        ),
    ]

    chapter(s, "15. Accuracy, causality, and limitations", styles)
    s += [
        heading("15.1 Major failure modes", 2, styles),
        data_table(
            ["Cause", "Symptom", "Response"],
            [
                ["Channel collinearity", "Overlapping intervals, unstable signs", "Aggregate, experiment, add varied periods"],
                ["Omitted confounder", "Inflated media effect, residual ACF", "Use supported promo/outage 0/1 events or steps. Continuous price/competition controls are not directly mapped; split the period, use external analysis, or disclose the limitation"],
                ["Measurement change", "Residual regime break", "Add step or split period"],
                ["Failed prior transfer", "Large prior shift, unstable country tuning", "Widen or remove prior"],
                ["Short history", "Transform disagreement", "Add time or reduce candidate grid"],
                ["Out-of-range budget", "Curve extrapolation", "Use incremental in-range changes"],
            ],
            [42, 68, 64],
            styles,
        ),
        heading("15.2 Language for positive probability", 2, styles),
        data_table(
            ["State", "Recommended", "Do not say"],
            [
                ["High; interval positive", "Strong evidence supporting a positive effect", "Causal effect is certain"],
                ["Middle; interval crosses 0", "Positive direction but uncertain; test", "No effect"],
                ["Low/negative", "Limited evidence of positive effect under these data/assumptions", "Advertising is certainly harmful"],
                ["Collinearity warning", "Individual channel is unidentified", "Definitive worst channel"],
            ],
            [42, 87, 45],
            styles,
        ),
        heading("15.3 Prior-selection bias", 2, styles),
        body(
            "Trying many countries and selecting the best creates a winner's-curse risk. Multiple folds, an instability surcharge, and a complexity penalty reduce but do not eliminate it. Confirm the recommendation in a later period or independent experiment.",
            styles,
        ),
        heading("15.4 Privacy", 2, styles),
        body(
            "CSV analysis stays in browser memory and is not transmitted or stored for modeling. Still, upload only aggregated week/country/channel data and exclude personally identifiable information.",
            styles,
        ),
    ]

    chapter(s, "16. Troubleshooting", styles)
    s += [
        heading("16.1 Upload and mapping", 2, styles),
        data_table(
            ["Symptom", "Likely cause", "Fix"],
            [
                ["Dates do not aggregate", "Mixed or invalid date formats", "Normalize to YYYY-MM-DD"],
                ["KPI inactive", "Y not mapped or values nonnumeric", "Map one of the five targets"],
                ["No prior for one Y", "That Y is absent in the prior file", "Expected; base model remains"],
                ["Channel prior missing", "Channel keys differ", "Align target and prior mapping keys"],
                ["Countries mixed", "Country missing/blank", "Populate a consistent code on every row"],
            ],
            [46, 66, 62],
            styles,
        ),
        heading("16.2 Model", 2, styles),
        data_table(
            ["Symptom", "Meaning", "Action"],
            [
                ["Very wide interval", "Low variation, collinearity, transform uncertainty", "Add time/test; aggregate channels"],
                ["Prior makes interval tiny", "Test CI/transfer variance too small", "Verify definitions; widen/remove"],
                ["High R2, poor base OOS", "Overfit or regime change", "Review events and steps"],
                ["High residual ACF", "Missing time structure", "Review trend, seasonality, adstock, events"],
                ["Negative natural demand", "Baseline misspecification/extrapolation", "Stop decision use; redesign"],
                ["Low top candidate weight", "Carryover/saturation weakly identified", "Use curve as a range"],
            ],
            [46, 67, 61],
            styles,
        ),
        heading("16.3 Experimental prior", 2, styles),
        data_table(
            ["Symptom", "Check"],
            [
                ["On/Off not generated", "At least 16 valid weeks, four weeks per state, two transitions, bounded Fieller, HAC, and block-jackknife diagnostics"],
                ["Geo not generated", "At least 16 geo-weeks, four geos, two per arm, common pre/post, all four cells, cluster/all-LOCO, bounded Fieller, and target Hill-derivative alignment"],
                ["Same KPI reuse blocked", "Check whether national On/Off KPI exactly matches main-MMM Y in the same weeks; use only separately identified experiment aggregation"],
                ["Very large SE", "Duration, geo count, intensity, and concurrent events; a weak prior is valid"],
                ["Unexpected sign", "KPI direction, state/arm/period coding, spend unit, and time order"],
                ["Geo estimates unstable", "Geo sample sizes, pre-trends, and enough clusters"],
            ],
            [51, 123],
            styles,
        ),
        heading("16.4 Country priors", 2, styles),
        bullets(
            [
                "Zero eligible countries: inspect overlapping channels, KPI, date range, and country mapping.",
                "Confirm at least 24 valid weekly rows for every reference country.",
                "Every candidate loses to baseline: no prior is the correct result.",
                "With only 36-47 target weeks, one fold is insufficient and the base is retained. Require at least two folds (typically 48 weeks), preferably three.",
                "Many countries visible: distinguish the eligible-country list from the one recommended combination.",
                "Fold winners change: use score including fold SD and complexity, not mean alone.",
                "Country coefficients disagree: tau^2 should reduce precision.",
            ],
            styles,
        ),
    ]

    chapter(s, "17. Review and presentation checklist", styles)
    s += [
        heading("17.1 Data approval", 2, styles),
        bullets(
            [
                "Document geography, period, week definition, currency, KPI definition, and conversion window.",
                "Verify daily-to-weekly and event-occurrence rules.",
                "Review missingness, duplicates, partial weeks, and measurement changes.",
                "Encode supported promotions, holidays, and outages as exact 0/1 events/steps. Disclose price-definition changes and the inability to map arbitrary continuous price/competition controls.",
            ],
            styles,
        ),
        heading("17.2 Model approval", 2, styles),
        bullets(
            [
                "Compare the no-prior and with-prior models.",
                "Review OOS wMAPE only for the no-external-prior base, plus coverage, residual ACF, negative baseline, and prior shift.",
                "Record candidate count, effective candidates, and top weight.",
                "Do not force rankings where intervals overlap or channels are collinear.",
                "Do not label contribution-magnitude share as Shapley R2.",
            ],
            styles,
        ),
        heading("17.3 Prior approval", 2, styles),
        bullets(
            [
                "Disclose experiment design, period, KPI, intensity, and uncertainty calculation.",
                "Review overlap and exact-match diagnostics between experiment KPI and main-MMM Y, and confirm that the same outcome was not used twice.",
                "Human-verify country definitions, currency, and conversion windows.",
                "Disclose country rolling folds and complexity penalty.",
                "Confirm that unmatched Y targets received no prior.",
            ],
            styles,
        ),
        heading("17.4 Suggested disclosure", 2, styles),
        callout(
            "Presentation language",
            "This result is a conditional Gaussian empirical-Bayes MMM using weekly observational data, plug-in residual variance, carryover/saturation candidates, and Normal priors where available. Transform uncertainty is incorporated through per-channel profile BIC averaging; this is not a fully hierarchical joint MCMC model. Channel estimates are ranged decision evidence to be used with experiments and holdouts, not causal point truth.",
            styles,
            "teal",
        ),
    ]

    chapter(s, "18. Glossary", styles)
    glossary_rows = [
        ["Adstock", "Media state combining current execution and prior carryover"],
        ["alpha", "Weekly persistence fraction in geometric adstock"],
        ["Hill", "Saturating response function"],
        ["ec / half-saturation", "Adstock at half normalized response"],
        ["slope", "Curvature/steepness of the Hill function"],
        ["Prior", "Parameter distribution before fitting target observations"],
        ["Posterior", "Parameter distribution after combining data and prior"],
        ["Precision", "Inverse variance; larger means stronger evidence"],
        ["90% interval", "Range describing coefficient uncertainty under the model/approximation"],
        ["Profile model", "Refit that varies one channel's transform candidate"],
        ["BIC weight", "Relative candidate weight balancing fit and complexity"],
        ["Effective candidates", "Inverse concentration of candidate weights"],
        ["OOS", "Out-of-sample period excluded from training"],
        ["wMAPE", "Sum absolute error divided by sum absolute actual"],
        ["Coverage", "Share of actuals inside a predictive interval"],
        ["Residual ACF1", "Correlation of adjacent weekly residuals"],
        ["DiD", "Difference in pre/post changes between treatment and control"],
        ["HAC SE", "Standard error robust to time autocorrelation/heteroskedasticity"],
        ["Cluster-robust SE", "Standard error allowing within-geo error correlation"],
        ["Jackknife", "Instability estimate from repeatedly omitting blocks"],
        ["tau^2", "Between-country transfer heterogeneity variance"],
        ["Ridge", "L2 regularization reducing extreme coefficients"],
        ["R-hat", "MCMC convergence metric; not applicable here"],
        ["Shapley R2", "Permutation-based allocation of explanatory power; not the current driver-share table"],
        ["Incrementality", "Effect relative to the counterfactual without advertising"],
    ]
    s += [data_table(["Term", "Definition"], glossary_rows, [50, 124], styles)]

    chapter(s, "Appendix A. Calculation-to-screen map", styles)
    s += [
        data_table(
            ["Screen element", "Calculation source", "Review question"],
            [
                ["Weekly contribution", "Representative transform + posterior mean", "Is representative-candidate dependence disclosed?"],
                ["Effect 90% interval", "Conditional Gaussian for prior channels / profile-mixture CDF quantiles otherwise", "Does it cross zero; are candidates diffuse?"],
                ["Positive probability", "BIC-weighted candidate Gaussian probabilities", "Is it being overstated as causal probability?"],
                ["Response curve", "Weighted steady-state adstock responses", "Is spend inside the observed range?"],
                ["Magnitude share", "Normalized mean(contribution^2)", "Is it incorrectly called Shapley R2?"],
                ["Experiment prior", "Effect/exposure ratio + conservative variance", "Is transportability defensible?"],
                ["Country prior", "Country coefficient + tau^2 + rolling selection", "Is selection bias disclosed?"],
                ["Forecast", "Future features + posterior predictive variance", "Are event/regime assumptions explicit?"],
            ],
            [45, 79, 50],
            styles,
        )
    ]

    chapter(s, "Appendix B. Official references", styles)
    sources = [
        ("Google Meridian - Model specification", "https://developers.google.com/meridian/docs/advanced-modeling/model-spec"),
        ("Google Meridian - ModelSpec API", "https://developers.google.com/meridian/reference/api/meridian/model/spec/ModelSpec"),
        ("Google Meridian - ROI priors and calibration", "https://developers.google.com/meridian/docs/advanced-modeling/roi-priors-and-calibration"),
        ("Google Meridian - Choosing treatment prior types", "https://developers.google.com/meridian/docs/advanced-modeling/how-to-choose-treatment-prior-types"),
        ("Google Meridian - Collect data", "https://developers.google.com/meridian/docs/pre-modeling/collect-data"),
        ("Google Meridian - Geo selection and national data", "https://developers.google.com/meridian/docs/pre-modeling/geo-selection-national-data"),
        ("Google Meridian - Model health checks", "https://developers.google.com/meridian/docs/post-modeling/health-checks"),
        ("Google Meridian - Model fit", "https://developers.google.com/meridian/docs/post-modeling/model-fit"),
        ("Google Meridian - Model diagnostics", "https://developers.google.com/meridian/docs/user-guide/model-diagnostics"),
        ("Google Meridian - Interpret visualizations", "https://developers.google.com/meridian/docs/post-modeling/interpret-visualizations"),
        ("Google Meridian source repository", "https://github.com/google/meridian"),
    ]
    s += [
        body(
            "These official Google pages and repository are the comparison basis. Meridian changes over time; re-check current documentation before an implementation decision.",
            styles,
        )
    ]
    s += [source_item(title, url, styles) for title, url in sources]
    s += [
        Spacer(1, 4 * mm),
        callout(
            "Version note",
            f"This handbook covers MMM methodology {MODEL_VERSION}: the conditional Gaussian empirical-Bayes MMM, per-channel profile averaging, experiment/country priors, repeated validation, and health checks. Archive the handbook date with the model version used in a presentation.",
            styles,
            "purple",
        ),
    ]
    return s


def build_manual(path: Path, locale: str, styles: dict[str, ParagraphStyle]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    story = korean_story(styles) if locale == "ko" else english_story(styles)
    doc = ManualDocTemplate(str(path), locale, styles)
    doc.multiBuild(story)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-root",
        default="v2-migration/public/manuals",
        help="Directory for the app-delivered manuals",
    )
    parser.add_argument(
        "--copy-root",
        default="output/pdf",
        help="Optional review/delivery copy directory; pass an empty string to skip",
    )
    args = parser.parse_args()

    font_path = register_fonts()
    styles = build_styles()
    root = Path(args.output_root).resolve()
    outputs = [
        (root / "mmm-model-manual-ko.pdf", "ko"),
        (root / "mmm-model-manual-en.pdf", "en"),
    ]
    for path, locale in outputs:
        build_manual(path, locale, styles)

    if args.copy_root:
        copy_root = Path(args.copy_root).resolve()
        copy_root.mkdir(parents=True, exist_ok=True)
        for path, _ in outputs:
            shutil.copy2(path, copy_root / path.name)

    print(f"font={font_path}")
    for path, _ in outputs:
        print(f"generated={path} bytes={path.stat().st_size}")


if __name__ == "__main__":
    main()
