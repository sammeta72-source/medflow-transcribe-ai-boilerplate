#!/usr/bin/env python3
"""
MedFlow Transcribe AI — Global Healthcare Compliance Specification
Generates a comprehensive, multi-page PDF specification document covering
HIPAA, GDPR, EU MDR, ISO 13485/27001, HITRUST, SOC 2, FHIR, DICOM, and more.
Output: /home/z/my-project/download/MedFlow_Compliance_Specification.pdf
"""

import hashlib
import os
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, Image, ListFlowable, ListItem, HRFlowable, CondPageBreak,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
from reportlab.platypus.frames import Frame
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4

# ── MedFlow teal/green palette (matches the app brand) ──────────────────────
PAGE_BG       = colors.HexColor('#FFFFFF')
SECTION_BG    = colors.HexColor('#E8F8F5')   # mint
CARD_BG       = colors.HexColor('#f0faf8')
TABLE_STRIPE  = colors.HexColor('#E8F8F5')
HEADER_FILL   = colors.HexColor('#0B5345')   # deep teal (primary)
COVER_BLOCK   = colors.HexColor('#0B5345')
BORDER        = colors.HexColor('#d4e6e0')
ICON          = colors.HexColor('#1ABC9C')
ACCENT        = colors.HexColor('#1ABC9C')   # sea green (secondary)
ACCENT_2      = colors.HexColor('#16a085')
TEXT_PRIMARY  = colors.HexColor('#17202A')   # dark slate
TEXT_MUTED    = colors.HexColor('#5b6770')
SEM_SUCCESS   = colors.HexColor('#387c4e')
SEM_WARNING   = colors.HexColor('#ad8c49')
SEM_ERROR     = colors.HexColor('#a8564f')
SEM_INFO      = colors.HexColor('#4977a5')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ── Try to register a nicer font; fall back to Helvetica ─────────────────────
def register_fonts():
    font_candidates = [
        # (name, path)
        ("Body", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        ("BodyBold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        ("BodyItalic", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"),
    ]
    registered = {}
    for name, path in font_candidates:
        try:
            if os.path.exists(path):
                pdfmetrics.registerFont(TTFont(name, path))
                registered[name] = True
        except Exception:
            pass
    # Register font family mapping if all three loaded
    if all(n in registered for n in ("Body", "BodyBold", "BodyItalic")):
        from reportlab.pdfbase.pdfmetrics import registerFontFamily
        registerFontFamily("Body", normal="Body", bold="BodyBold", italic="BodyItalic")
        return "Body", "BodyBold", "BodyItalic"
    return "Helvetica", "Helvetica-Bold", "Helvetica-Oblique"

FONT, FONT_BOLD, FONT_ITALIC = register_fonts()

# ── Styles ──────────────────────────────────────────────────────────────────
def make_styles():
    ss = getSampleStyleSheet()
    base = ss["Normal"]
    styles = {}

    styles["CoverTitle"] = ParagraphStyle("CoverTitle", parent=base,
        fontName=FONT_BOLD, fontSize=30, leading=36, textColor=colors.white,
        alignment=TA_LEFT, spaceBefore=0, spaceAfter=8)
    styles["CoverSubtitle"] = ParagraphStyle("CoverSubtitle", parent=base,
        fontName=FONT, fontSize=13, leading=18, textColor=colors.HexColor('#E8F8F5'),
        alignment=TA_LEFT, spaceBefore=6, spaceAfter=6)
    styles["CoverMeta"] = ParagraphStyle("CoverMeta", parent=base,
        fontName=FONT, fontSize=9, leading=12, textColor=colors.HexColor('#1ABC9C'),
        alignment=TA_LEFT, spaceBefore=2, spaceAfter=2)

    styles["H1"] = ParagraphStyle("H1", parent=base,
        fontName=FONT_BOLD, fontSize=18, leading=22, textColor=HEADER_FILL,
        spaceBefore=18, spaceAfter=10, keepWithNext=True)
    styles["H2"] = ParagraphStyle("H2", parent=base,
        fontName=FONT_BOLD, fontSize=13, leading=16, textColor=TEXT_PRIMARY,
        spaceBefore=12, spaceAfter=6, keepWithNext=True)
    styles["H3"] = ParagraphStyle("H3", parent=base,
        fontName=FONT_BOLD, fontSize=11, leading=14, textColor=ACCENT_2,
        spaceBefore=8, spaceAfter=4, keepWithNext=True)
    styles["Body"] = ParagraphStyle("Body", parent=base,
        fontName=FONT, fontSize=9.5, leading=14, textColor=TEXT_PRIMARY,
        alignment=TA_JUSTIFY, spaceBefore=2, spaceAfter=6)
    styles["BodyTight"] = ParagraphStyle("BodyTight", parent=base,
        fontName=FONT, fontSize=9, leading=12.5, textColor=TEXT_PRIMARY,
        alignment=TA_JUSTIFY, spaceBefore=1, spaceAfter=3)
    styles["Bullet"] = ParagraphStyle("Bullet", parent=base,
        fontName=FONT, fontSize=9.5, leading=13, textColor=TEXT_PRIMARY,
        leftIndent=14, bulletIndent=4, spaceBefore=1, spaceAfter=2)
    styles["Caption"] = ParagraphStyle("Caption", parent=base,
        fontName=FONT_ITALIC, fontSize=8, leading=10, textColor=TEXT_MUTED,
        alignment=TA_CENTER, spaceBefore=2, spaceAfter=8)
    styles["TableCell"] = ParagraphStyle("TableCell", parent=base,
        fontName=FONT, fontSize=7.5, leading=9.5, textColor=TEXT_PRIMARY,
        alignment=TA_LEFT)
    styles["TableCellBold"] = ParagraphStyle("TableCellBold", parent=base,
        fontName=FONT_BOLD, fontSize=7.5, leading=9.5, textColor=TEXT_PRIMARY,
        alignment=TA_LEFT)
    styles["TableHeader"] = ParagraphStyle("TableHeader", parent=base,
        fontName=FONT_BOLD, fontSize=8, leading=10, textColor=colors.white,
        alignment=TA_LEFT)
    styles["Callout"] = ParagraphStyle("Callout", parent=base,
        fontName=FONT_ITALIC, fontSize=9.5, leading=13, textColor=HEADER_FILL,
        leftIndent=12, rightIndent=12, spaceBefore=4, spaceAfter=8,
        borderColor=ACCENT, borderWidth=0, borderPadding=8,
        backColor=SECTION_BG)
    styles["TOC1"] = ParagraphStyle("TOC1", fontName=FONT_BOLD, fontSize=10,
        leading=14, leftIndent=0, textColor=HEADER_FILL)
    styles["TOC2"] = ParagraphStyle("TOC2", fontName=FONT, fontSize=9,
        leading=12, leftIndent=16, textColor=TEXT_PRIMARY)
    styles["Disclaimer"] = ParagraphStyle("Disclaimer", parent=base,
        fontName=FONT_ITALIC, fontSize=7.5, leading=10, textColor=TEXT_MUTED,
        alignment=TA_JUSTIFY, spaceBefore=4, spaceAfter=4)
    return styles

STYLES = make_styles()

# ── TOC doc template ─────────────────────────────────────────────────────────
class TocDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kw):
        BaseDocTemplate.__init__(self, filename, **kw)
        # Single frame for body content
        frame = Frame(2.0*cm, 1.8*cm, A4[0] - 4.0*cm, A4[1] - 3.6*cm,
                      id="body", leftPadding=0, rightPadding=0,
                      topPadding=0, bottomPadding=0)
        # Cover frame (full page, no margins)
        cover_frame = Frame(0, 0, A4[0], A4[1], id="cover",
                            leftPadding=0, rightPadding=0,
                            topPadding=0, bottomPadding=0)
        self.addPageTemplates([
            PageTemplate(id="Cover", frames=[cover_frame]),
            PageTemplate(id="Body", frames=[frame], onPage=self._draw_page_chrome),
        ])

    def afterFlowable(self, flowable):
        if hasattr(flowable, "bookmark_name"):
            level = getattr(flowable, "bookmark_level", 0)
            text = getattr(flowable, "bookmark_text", "")
            key = getattr(flowable, "bookmark_key", "")
            self.notify("TOCEntry", (level, text, self.page, key))

    def _draw_page_chrome(self, canvas, doc):
        """Draw header/footer on every body page."""
        canvas.saveState()
        # Top accent bar
        canvas.setFillColor(HEADER_FILL)
        canvas.rect(0, A4[1] - 0.5*cm, A4[0], 0.5*cm, fill=1, stroke=0)
        # Footer
        canvas.setFillColor(colors.HexColor('#17202A'))
        canvas.rect(0, 0, A4[0], 1.0*cm, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor('#E8F8F5'))
        canvas.setFont(FONT, 7)
        canvas.drawString(2.0*cm, 0.35*cm, "MedFlow Transcribe AI — Global Healthcare Compliance Specification")
        canvas.drawRightString(A4[0] - 2.0*cm, 0.35*cm, f"Page {doc.page}")
        canvas.setFillColor(colors.HexColor('#1ABC9C'))
        canvas.setFont(FONT_BOLD, 7)
        canvas.drawCentredString(A4[0]/2, 0.35*cm, "CONFIDENTIAL · For Engineering & Compliance Teams")
        canvas.restoreState()

# ── Heading helper (with TOC bookmark) ───────────────────────────────────────
def heading(text, style, level=0):
    key = f"h_{hashlib.md5(text.encode()).hexdigest()[:8]}"
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def para(text, style_key="Body"):
    return Paragraph(text, STYLES[style_key])

def bullets(items, style_key="Bullet"):
    return ListFlowable(
        [ListItem(Paragraph(t, STYLES[style_key]), value="•") for t in items],
        bulletType="bullet", start="•", leftIndent=14,
    )

def callout(text):
    return Paragraph(text, STYLES["Callout"])

# ── Table builder ───────────────────────────────────────────────────────────
def make_table(data, col_widths, header=True, stripe=True):
    """data: list of rows; each row is list of cell strings (or Paragraphs)."""
    rows = []
    for r_idx, row in enumerate(data):
        new_row = []
        for c_idx, cell in enumerate(row):
            if isinstance(cell, str):
                if header and r_idx == 0:
                    p = Paragraph(cell, STYLES["TableHeader"])
                else:
                    p = Paragraph(cell, STYLES["TableCell"])
            else:
                p = cell
            new_row.append(p)
        rows.append(new_row)
    t = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
    ]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_COLOR))
        style.append(("TEXTCOLOR", (0, 0), (-1, 0), TABLE_HEADER_TEXT))
    if stripe:
        for i in range(1 if header else 0, len(rows)):
            bg = TABLE_ROW_ODD if (i % 2 == (1 if header else 0)) else TABLE_ROW_EVEN
            style.append(("BACKGROUND", (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style))
    return t


# ============================================================================
# CONTENT BUILDERS
# ============================================================================

def build_cover(story):
    """Cover page drawn via a full-bleed table."""
    from reportlab.platypus import Frame, FrameBreak
    # Use a full-page table with teal background
    cover_inner = []
    cover_inner.append(Spacer(1, 4*cm))
    cover_inner.append(Paragraph("MedFlow Transcribe AI", STYLES["CoverMeta"]))
    cover_inner.append(Spacer(1, 0.4*cm))
    cover_inner.append(Paragraph("Global Healthcare<br/>Compliance Specification", STYLES["CoverTitle"]))
    cover_inner.append(Spacer(1, 0.3*cm))
    cover_inner.append(Paragraph(
        "Enterprise-Grade Regulatory Framework for AI-Assisted Medical Transcription Operations",
        STYLES["CoverSubtitle"]))
    cover_inner.append(Spacer(1, 1.5*cm))
    # Standards badges
    badges = Table([[
        Paragraph('<font color="white"><b>HIPAA</b></font>', STYLES["CoverMeta"]),
        Paragraph('<font color="white"><b>GDPR</b></font>', STYLES["CoverMeta"]),
        Paragraph('<font color="white"><b>EU MDR</b></font>', STYLES["CoverMeta"]),
        Paragraph('<font color="white"><b>ISO 13485</b></font>', STYLES["CoverMeta"]),
        Paragraph('<font color="white"><b>HITRUST</b></font>', STYLES["CoverMeta"]),
        Paragraph('<font color="white"><b>SOC 2</b></font>', STYLES["CoverMeta"]),
    ]], colWidths=[2.6*cm]*6)
    badges.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor('#0d6651')),
        ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor('#1ABC9C')),
        ("INNERGRID", (0,0), (-1,-1), 0.5, colors.HexColor('#1ABC9C')),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
    ]))
    cover_inner.append(badges)
    cover_inner.append(Spacer(1, 2*cm))
    cover_inner.append(Paragraph("Document Version 1.0  ·  Tier 3 Enterprise", STYLES["CoverMeta"]))
    cover_inner.append(Paragraph("Prepared for: Software Architects · Compliance Officers · Regulatory Affairs", STYLES["CoverMeta"]))
    cover_inner.append(Paragraph("Audience: Engineering, QA, Security, Legal, Clinical Operations", STYLES["CoverMeta"]))
    cover_inner.append(Spacer(1, 3*cm))
    cover_inner.append(Paragraph("© 2026 MedFlow Transcribe AI  ·  Confidential", STYLES["CoverMeta"]))
    # Wrap in a full-bleed teal table
    cover_tbl = Table([[cover_inner]], colWidths=[A4[0]], rowHeights=[A4[1]])
    cover_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), HEADER_FILL),
        ("LEFTPADDING", (0,0), (-1,-1), 2.5*cm),
        ("RIGHTPADDING", (0,0), (-1,-1), 2.5*cm),
        ("TOPPADDING", (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
    ]))
    story.append(cover_tbl)
    story.append(PageBreak())


def build_toc(story):
    story.append(heading("Table of Contents", STYLES["H1"], level=0))
    story.append(Spacer(1, 0.3*cm))
    toc = TableOfContents()
    toc.levelStyles = [STYLES["TOC1"], STYLES["TOC2"]]
    story.append(toc)
    story.append(PageBreak())


def build_executive_summary(story):
    story.append(heading("1. Executive Summary", STYLES["H1"], level=0))
    story.append(para(
        "MedFlow Transcribe AI is an AI-assisted medical transcription operations platform engineered from the ground up to satisfy the world's most demanding healthcare regulatory frameworks. This specification defines the feature, module, and tier architecture required to deploy the platform as a globally compliant, enterprise-grade Software-as-a-Service offering across the United States, European Union/EEA, Canada, Australia, and international markets governed by ISO standards."
    ))
    story.append(para(
        "The platform's compliance posture is built on three reinforcing pillars: (1) a <b>Core Compliance Foundation</b> covering identity, encryption, audit, e-signatures, consent, and data-subject rights — satisfying HIPAA Security Rule (45 CFR 164.312), GDPR Articles 5–17 & 32, and ISO 27001 Annex A; (2) <b>Advanced Security & Clinical Safety</b> layers covering 21 CFR Part 11 e-signatures, ISO 14971 risk management, clinical decision support, and adverse-event reporting; and (3) <b>Enterprise Interoperability & Quality Management</b> covering FHIR R4/R5, HL7 v2, DICOM, ISO 13485 QMS, and post-market surveillance under EU MDR 2017/745."
    ))
    story.append(para(
        "Three compliance tiers (Foundation, Advanced, Enterprise) provide a progressive adoption path: Tier 1 establishes the HIPAA/GDPR baseline required to process protected health information in any jurisdiction; Tier 2 adds FDA 21 CFR Part 11 e-signature controls and ISO 27001 information security management for regulated medical-device-adjacent workflows; Tier 3 delivers the full medical-device QMS (ISO 13485), clinical risk management (ISO 14971), post-market surveillance, and third-party audit readiness (HITRUST CSF, SOC 2 Type II) required for hospital, health-system, and large-BPO deployments."
    ))
    story.append(callout(
        "Regulatory coverage: 6 primary jurisdictions (US, EU/EEA, Canada, Australia, ISO international), 18 named regulations/standards, 8 core compliance modules, 5 interoperability standards, 3 compliance tiers. Every feature in this specification is cross-mapped to one or more specific regulatory citations to enable audit-ready traceability."
    ))
    story.append(Spacer(1, 0.3*cm))
    # Compliance posture summary table
    story.append(heading("1.1 Compliance Posture at a Glance", STYLES["H2"], level=1))
    data = [
        ["Jurisdiction", "Primary Regulation", "Citation", "Tier Required", "Status"],
        ["United States", "HIPAA Privacy + Security Rule", "45 CFR 160 & 164", "Tier 1", "Full"],
        ["United States", "HITECH Act (Breaches + Audits)", "Pub.L. 111-5", "Tier 1", "Full"],
        ["United States", "21 CFR Part 11 (E-Signatures)", "21 CFR 11", "Tier 2", "Full"],
        ["United States", "FDA SaMD Guidance", "21 USC 360c", "Tier 3", "Aligned"],
        ["United States", "CMS / ONC Interoperability", "45 CFR 170", "Tier 2", "Full"],
        ["EU / EEA", "GDPR (Data Protection)", "Reg. 2016/679", "Tier 1", "Full"],
        ["EU / EEA", "EU MDR (Medical Device Reg.)", "Reg. 2017/745", "Tier 3", "Full"],
        ["EU / EEA", "EU IVDR (In Vitro Diagnostic)", "Reg. 2017/746", "Tier 3", "Aligned"],
        ["EU / EEA", "EHDS (Health Data Space)", "Reg. 2025/327", "Tier 3", "Roadmap"],
        ["EU / EEA", "NIS2 Directive (Cybersecurity)", "Dir. 2022/2555", "Tier 2", "Full"],
        ["Canada", "PIPEDA", "P.L. 2000, c.5", "Tier 1", "Full"],
        ["Canada", "PHIPA (Ontario)", "S.O. 2004, c.3", "Tier 1", "Full"],
        ["Australia", "Privacy Act 1988 (APPs)", "Cth", "Tier 1", "Full"],
        ["Australia", "My Health Records Act 2012", "Cth", "Tier 1", "Full"],
        ["International", "ISO 13485 (Medical QMS)", "ISO 13485:2016", "Tier 3", "Full"],
        ["International", "ISO 27001 (InfoSec)", "ISO 27001:2022", "Tier 2", "Full"],
        ["International", "ISO 14971 (Risk Mgmt)", "ISO 14971:2019", "Tier 3", "Full"],
        ["International", "HITRUST CSF", "v11.4", "Tier 3", "Full"],
        ["International", "SOC 2 Type II", "AICPA TSC", "Tier 3", "Full"],
    ]
    story.append(make_table(data, [2.2*cm, 4.2*cm, 3.2*cm, 2.2*cm, 2.0*cm]))
    story.append(Spacer(1, 0.2*cm))
    story.append(para(
        "This specification should be read alongside the MedFlow Transcribe AI functional specification (the BPO build prompt) and the system architecture diagram. Where this document references a specific regulatory citation (e.g., \"45 CFR 164.312(a)(1)\"), that citation is the authoritative source for the corresponding control; the technical implementation requirements that follow each citation describe how MedFlow satisfies the control."
    ))
    story.append(PageBreak())


def build_feature_matrix(story):
    story.append(heading("2. Feature Matrix — Feature × Regulation Mapping", STYLES["H1"], level=0))
    story.append(para(
        "The matrix below maps every core feature to the regulatory frameworks it satisfies. Cells use: <b>●</b> = primary control (feature directly satisfies the regulation), <b>◐</b> = supporting control (feature contributes to compliance), <b>○</b> = not applicable to that regulation. This cross-mapping enables compliance officers to demonstrate multi-jurisdictional coverage from a single feature inventory."
    ))
    story.append(Spacer(1, 0.2*cm))
    header = ["Feature", "HIPAA", "GDPR", "21 CFR 11", "EU MDR", "ISO 27001", "ISO 13485", "PIPEDA", "TGA"]
    rows = [header]
    features = [
        ("MFA + SSO (SAML/OIDC)", "●", "●", "●", "◐", "●", "◐", "●", "●"),
        ("RBAC + ABAC", "●", "●", "●", "◐", "●", "◐", "●", "●"),
        ("Break-glass emergency access", "●", "◐", "●", "◐", "●", "◐", "●", "◐"),
        ("AES-256 at rest + TLS 1.3", "●", "●", "●", "●", "●", "●", "●", "●"),
        ("HSM-backed key management", "●", "●", "●", "●", "●", "●", "●", "●"),
        ("Immutable audit trail (6+ yr)", "●", "●", "●", "●", "●", "●", "●", "●"),
        ("SIEM + anomaly detection", "●", "●", "◐", "●", "●", "●", "●", "●"),
        ("21 CFR Part 11 e-signatures", "◐", "◐", "●", "●", "◐", "●", "◐", "◐"),
        ("Granular consent management", "●", "●", "○", "◐", "◐", "◐", "●", "●"),
        ("Data subject rights portal", "◐", "●", "○", "◐", "◐", "◐", "●", "●"),
        ("DPIA + privacy by design", "◐", "●", "○", "●", "●", "●", "◐", "◐"),
        ("Zero Trust + micro-segmentation", "●", "●", "◐", "●", "●", "◐", "●", "●"),
        ("DLP for PHI + watermarking", "●", "●", "◐", "◐", "●", "◐", "●", "●"),
        ("SBOM + DevSecOps pipeline", "◐", "◐", "◐", "●", "●", "●", "◐", "◐"),
        ("Clinical decision support (CDS)", "◐", "○", "◐", "●", "○", "●", "○", "◐"),
        ("ISO 14971 risk management", "○", "◐", "◐", "●", "◐", "●", "○", "●"),
        ("Adverse event reporting (MedWatch)", "○", "○", "◐", "●", "○", "●", "○", "●"),
        ("FHIR R4 server + SMART on FHIR", "●", "◐", "○", "◐", "○", "◐", "◐", "◐"),
        ("HL7 v2 interface engine", "◐", "○", "○", "◐", "○", "◐", "○", "○"),
        ("DICOM storage + DICOMweb", "◐", "○", "○", "◐", "○", "◐", "○", "○"),
        ("Terminology services (SNOMED/LOINC)", "◐", "○", "○", "◐", "○", "●", "○", "◐"),
        ("QMS document control (DHF/DMR/DHR)", "○", "○", "◐", "●", "◐", "●", "○", "●"),
        ("CSV IQ/OQ/PQ validation", "◐", "◐", "●", "●", "●", "●", "◐", "◐"),
        ("Post-market surveillance (PMS/PMCF)", "○", "○", "○", "●", "○", "●", "○", "●"),
        ("Multi-AZ HA + DR (<1h RTO)", "●", "●", "◐", "●", "●", "●", "●", "●"),
        ("Geo-redundant encrypted backups", "●", "●", "◐", "●", "●", "●", "●", "●"),
        ("Breach notification workflows", "●", "●", "◐", "◐", "●", "◐", "●", "●"),
        ("WCAG 2.1 AA accessibility", "◐", "●", "◐", "◐", "○", "○", "●", "●"),
    ]
    rows.extend(features)
    col_w = [5.5*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.6*cm, 1.6*cm, 1.5*cm, 1.5*cm]
    story.append(make_table(rows, col_w))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(
        "<b>Legend:</b> ● = primary control (feature directly satisfies the regulation) · "
        "◐ = supporting control (feature contributes) · ○ = not applicable.",
        STYLES["Caption"]))
    story.append(PageBreak())


def build_module_specs(story):
    story.append(heading("3. Core Compliance Modules", STYLES["H1"], level=0))
    story.append(para(
        "Each module below specifies: (a) feature name and description, (b) regulatory mapping with specific citations, (c) technical implementation requirements, (d) validation and testing criteria, and (e) audit and documentation requirements. Modules are grouped into the eight functional domains required for global healthcare compliance."
    ))

    # ── Module 3.1: Identity & Access Management ─────────────────────────────
    story.append(heading("3.1 Identity & Access Management (IAM)", STYLES["H2"], level=1))
    story.append(para(
        "The IAM module governs every authentication and authorization decision in the platform. It implements a defense-in-depth identity architecture combining multi-factor authentication, federated single sign-on, role- and attribute-based access control, and break-glass emergency access — all aligned to NIST SP 800-63B digital identity guidelines."
    ))
    story.append(heading("Regulatory Mapping", STYLES["H3"], level=2))
    story.append(bullets([
        "<b>HIPAA Security Rule — Access Control</b>: 45 CFR 164.312(a)(1) (technical safeguards), 164.312(a)(2)(i) (unique user IDs), 164.312(a)(2)(iii) (automatic logoff), 164.308(a)(3) (workforce security), 164.308(a)(4) (information access management).",
        "<b>HIPAA Security Rule — Authentication</b>: 45 CFR 164.312(d) (person or entity authentication).",
        "<b>GDPR</b>: Article 5(1)(f) (integrity & confidentiality), Article 32 (security of processing), Recital 78 (authentication).",
        "<b>21 CFR Part 11</b>: §11.10(b) (authority checks), §11.10(d) (device checks), §11.200(a) (signature controls).",
        "<b>ISO 27001:2022</b>: Annex A.5.15–A.5.18 (access control), A.8.2–A.8.5 (secure HR).",
        "<b>ISO 13485:2016</b>: §4.2.4 (records of access), §6.3 (infrastructure access).",
        "<b>NIST SP 800-63B</b>: §4 (authenticator assurance levels AAL1/AAL2/AAL3).",
        "<b>NIS2 Directive</b>: Article 21(2)(b) (access control policies).",
    ]))
    story.append(heading("Technical Implementation Requirements", STYLES["H3"], level=2))
    story.append(bullets([
        "<b>Multi-Factor Authentication (MFA)</b>: TOTP (RFC 6238) + WebAuthn (FIDO2) for privileged roles; mandatory for all PHI-accessing roles. NIST AAL2 minimum, AAL3 for e-signature workflows.",
        "<b>Single Sign-On (SSO)</b>: SAML 2.0 (for enterprise IdPs — Azure AD, Okta, PingFederate), OAuth 2.0 + OpenID Connect (for cloud + SMART on FHIR app launch). Support SCIM 2.0 for just-in-time provisioning + deprovisioning.",
        "<b>RBAC</b>: 12 pre-defined healthcare roles (Platform Super Admin, Tenant Owner, Provider, Transcriptionist, Medical Editor, QA Analyst, etc.) with least-privilege permission sets enforced at UI, API, database-query, and file-access layers.",
        "<b>ABAC</b>: Attribute-based policies for dynamic access — e.g., \"a Transcriptionist may only access jobs where specialty ∈ user.skills AND shift is active AND client is eligible.\" Evaluated via OPA (Open Policy Agent) Rego policies.",
        "<b>Break-Glass Emergency Access</b>: Time-boxed (default 4h), fully audit-logged, auto-revokes on expiry, requires post-access justification + manager review within 24h. Dedicated audit queue with alerting.",
        "<b>Session Management</b>: 15-min idle timeout (PHI contexts), 8h absolute session limit, sliding-window refresh, concurrent-session limit per role, signed JWT (RS256) with 5-min rotation, refresh-token rotation with reuse detection.",
        "<b>Password Policies</b>: NIST 800-63B §5 — minimum 8 chars (encourage passphrases), breach-corpus check (HIBP API), no forced periodic rotation, no composition rules, rate-limit + lockout after 5 failures, account-recovery via verified channel.",
    ]))
    story.append(heading("Validation & Testing Criteria", STYLES["H3"], level=2))
    story.append(bullets([
        "Authentication bypass: <b>OWASP ASVS L2</b> test suite (100% pass required).",
        "RBAC enforcement: every API endpoint tested with every role (≥ 144 endpoint × role assertions); negative tests confirm 403 for unauthorized.",
        "Break-glass: end-to-end test — invoke, verify access granted within 30s, verify auto-revoke at T+4h, verify audit entry + manager alert.",
        "Session: idle-timeout fired within 15min ±30s; concurrent-session limit rejects 2nd login; refresh-token reuse triggers revocation.",
        "Penetration test: annual third-party (CREST/OSCP-certified), covering OWASP Top 10 + auth-specific attacks (credential stuffing, JWT tampering, session fixation).",
    ]))
    story.append(heading("Audit & Documentation Requirements", STYLES["H3"], level=2))
    story.append(bullets([
        "Every authentication event (login, logout, MFA challenge, MFA success/failure, break-glass, session-refresh) → immutable audit entry with user_id, role, IP, device fingerprint, geolocation, timestamp (UTC), correlation_id.",
        "Role assignments + permission changes → audited + retained 6 years (HIPAA) / 10+ years (EU MDR).",
        "Access reviews: quarterly recertification report listing all active users × roles × last-login; stale-access (>90 days) flagged.",
        "BAA + DPA (Data Processing Agreement) on file for every identity-provider integration; documented in the vendor-risk register.",
    ]))
    story.append(PageBreak())

    # ── Module 3.2: Data Encryption ──────────────────────────────────────────
    story.append(heading("3.2 Data Encryption & Key Management", STYLES["H2"], level=1))
    story.append(para(
        "Encryption is the foundational safeguard protecting PHI/PII confidentiality at rest, in transit, and during processing. The encryption module mandates AES-256 for stored data, TLS 1.3 for network transport, end-to-end encryption for clinical messaging, and FIPS 140-2 Level 3 HSM-backed key management with automated rotation."
    ))
    story.append(heading("Regulatory Mapping", STYLES["H3"], level=2))
    story.append(bullets([
        "<b>HIPAA Security Rule</b>: 45 CFR 164.312(a)(2)(iv) (encryption + decryption), 164.312(e)(2)(ii) (transmission security), 164.308(a)(1) (security management — key mgmt).",
        "<b>GDPR</b>: Article 32(1)(a) (pseudonymisation + encryption of processing systems).",
        "<b>21 CFR Part 11</b>: §11.10(c) (device checks) + §11.50 (signature manifestations — record integrity).",
        "<b>EU MDR</b>: Annex I §17.2 (cybersecurity — state-of-the-art encryption).",
        "<b>ISO 27001:2022</b>: Annex A.8.24 (cryptography — key management), A.8.14 (redundancy).",
        "<b>ISO 27799:2016</b>: §7.3 (cryptographic controls for health info).",
        "<b>NIS2</b>: Article 21(2)(c) (encryption).",
        "<b>PIPEDA</b>: Principle 4.7 (safeguards — encryption).",
    ]))
    story.append(heading("Technical Implementation Requirements", STYLES["H3"], level=2))
    story.append(bullets([
        "<b>At-rest encryption</b>: AES-256-GCM for all databases (TDE), object storage (S3 SSE-KMS with customer-managed keys), backups, and snapshots. Application-level field encryption for the highest-sensitivity fields (SSN, MRN, mental-health notes) using envelope encryption (data key → KMS master key).",
        "<b>In-transit encryption</b>: TLS 1.3 mandatory (TLS 1.2 deprecated by 2026); HSTS preload; certificate pinning for mobile clients; mTLS for service-to-service; no fallback to plaintext. Perfect forward secrecy (ECDHE) required.",
        "<b>End-to-end encryption (messaging)</b>: Signal Protocol (X3DH + Double Ratchet) for provider↔patient secure messages; keys never leave end-user devices; server stores only ciphertext + metadata.",
        "<b>Key Management</b>: FIPS 140-2 Level 3 HSM (AWS CloudHSM / Azure Managed HSM / on-prem Thales) for master keys; envelope encryption for data keys; CMK rotation every 90 days (automatic); key-version history retained 10 years.",
        "<b>Key Hierarchy</b>: Master Key (HSM, never leaves) → Customer Master Key (KMS, per-tenant) → Data Encryption Key (per-record or per-batch) → Field Encryption Key (per-field). Each level audited.",
        "<b>Tokenization</b>: Vault-based tokenization for payment data (PCI DSS scope reduction) and optional PHI tokenization for analytics. Format-preserving tokens (FPE-FX) for legacy system compatibility.",
        "<b>Crypto-agility</b>: All crypto algorithms + key lengths are configurable + versioned. Post-quantum readiness: NIST PQC (CRYSTALS-Kyber for KEM, Dilithium for signatures) in a parallel-test track; migration plan for 2027.",
    ]))
    story.append(heading("Validation & Testing Criteria", STYLES["H3"], level=2))
    story.append(bullets([
        "Key rotation: automated test confirms ciphertext re-wrappable within 4h; no plaintext exposure during rotation.",
        "TLS configuration: SSL Labs grade A+ (no TLS 1.0/1.1, no RC4/3DES, no CBC suites); quarterly scan.",
        "Crypto fuzzing: libFuzzer + OSS-Fuzz on all crypto code paths; ≥ 1M iterations per release.",
        "HSM attestation: verify keys never exportable; session-audit-log review; tamper-evidence check.",
        "Side-channel: timing-attack testing on decryption paths (constant-time comparison required).",
    ]))
    story.append(heading("Audit & Documentation Requirements", STYLES["H3"], level=2))
    story.append(bullets([
        "Cryptographic inventory: algorithm, key length, location (service + field), purpose, rotation cadence, owner — maintained in a CMDB.",
        "Key lifecycle events (creation, rotation, revocation, destruction) → audited + retained 10 years (EU MDR) / 6 years (HIPAA).",
        "Annual crypto-review by a qualified cryptographer; documented in the ISO 27001 Statement of Applicability.",
        "BAA + HSM vendor attestation letter on file; reviewed annually.",
    ]))
    story.append(PageBreak())

    # ── Module 3.3: Audit Logging & Monitoring ───────────────────────────────
    story.append(heading("3.3 Audit Logging & Monitoring", STYLES["H2"], level=1))
    story.append(para(
        "The audit module produces an immutable, tamper-evident record of every action taken on protected health information — capturing who, what, when, where, and why for each access. Logs are streamed to a SIEM with real-time anomaly detection, retained for the longest applicable period (10+ years for EU MDR), and exportable on demand for regulatory inspections."
    ))
    story.append(heading("Regulatory Mapping", STYLES["H3"], level=2))
    story.append(bullets([
        "<b>HIPAA</b>: 45 CFR 164.308(a)(1)(ii)(c) (audit controls), 164.312(b) (audit controls — technical), 164.530(j) (accounting of disclosures — 6-year lookback).",
        "<b>HITECH</b>: §13408 (audit reports for business associates).",
        "<b>GDPR</b>: Article 30 (records of processing activities), Article 33 (breach notification within 72h), Article 35 (DPIA).",
        "<b>21 CFR Part 11</b>: §11.10(e) (secure, computer-generated, time-stamped audit trails).",
        "<b>EU MDR</b>: Article 87 (serious incident reporting), Annex III (PMS plan — trend analysis).",
        "<b>ISO 27001:2022</b>: Annex A.8.15 (logging), A.8.16 (monitoring), A.8.17 (clock sync).",
        "<b>NIS2</b>: Article 21(2)(d) (incident handling), Article 23 (24h early-warning reporting).",
        "<b>SOC 2</b>: CC7.2 (system operations + monitoring), CC7.3 (incident detection).",
    ]))
    story.append(heading("Technical Implementation Requirements", STYLES["H3"], level=2))
    story.append(bullets([
        "<b>Immutable audit store</b>: append-only, WORM (write-once-read-many) storage — S3 Object Lock in Compliance mode + quantum-resistant hash chain (each entry chained to the previous by SHA-256(prev_hash + payload)). Tampering renders the chain invalid.",
        "<b>Audit event schema</b>: {event_id, correlation_id, timestamp_utc, actor_id, actor_name, actor_role, action (login|file_access|edit|approval|signature|delivery|export|deletion), resource_type, resource_id, from_state, to_state, ip, device_fingerprint, geo (country/city), user_agent, purpose/why, metadata_json, hash, prev_hash}.",
        "<b>Captured actions</b>: login/logout, failed_login, MFA_change, permission_change, file_access, file_download, upload, transcription, ai_call, document_view, edit, approval, signature, delivery, export, deletion, billing_change, support_access, break_glass.",
        "<b>SIEM integration</b>: real-time streaming (Kafka → Splunk Enterprise Security / Microsoft Sentinel / Elastic SIEM). Pre-built dashboards for HIPAA, GDPR, and 21 CFR Part 11 audit queries.",
        "<b>Anomaly detection</b>: UEBA (user + entity behavior analytics) — bulk downloads (>50 docs/10min), impossible-travel (login from NYC + London within 1h), privilege-escalation patterns, off-hours access spikes. ML-based baselines per user/role.",
        "<b>Log retention</b>: HIPAA 6 years; GDPR 6 years (or until consent withdrawn + processing stopped); EU MDR 10+ years (device lifetime + 5); 21 CFR Part 11 5 years (post system retirement); configurable per-tenant up to 2555 days (7 years default).",
        "<b>Time sync</b>: NTP (stratum 2 min), with documented offset tolerance; RFC 3161 timestamp authority for e-signature events.",
        "<b>Accounting of disclosures</b>: HIPAA 164.528 — patient-requestable report of all disclosures in last 6 years, delivered within 30 days, with right-to-amend workflow.",
    ]))
    story.append(heading("Validation & Testing Criteria", STYLES["H3"], level=2))
    story.append(bullets([
        "Immutability: tamper-an-audit-entry test confirms hash-chain breaks + alerts within 60s.",
        "Coverage: 100% of PHI-access endpoints emit audit events (verified by code instrumentation + automated gap scan).",
        "SIEM: end-to-end test — generate an event → confirm arrives in SIEM within 30s → confirm dashboard query returns it.",
        "Anomaly: simulate bulk-download → confirm alert fires within 5min + auto-quarantines the session.",
        "Retention: verify 6-year-old events still queryable; verify auto-expiry at 6y (or 10y for MDR tenants).",
        "Accounting of disclosures: patient request → 30-day SLA; correctness verified against synthetic known-disclosure set.",
    ]))
    story.append(heading("Audit & Documentation Requirements", STYLES["H3"], level=2))
    story.append(bullets([
        "Audit-log architecture diagram + data-flow documentation maintained in the ISMS.",
        "Monthly audit-summary report (events, anomalies, escalations) to the privacy officer + security steering committee.",
        "Evidence-packaging workflow: 1-click export of filtered audit events as a signed PDF + JSON bundle for inspectors.",
        "Annual audit-log integrity verification (full hash-chain validation) — documented for SOC 2 / HITRUST evidence.",
    ]))
    story.append(PageBreak())

    # ── Module 3.4: Electronic Signatures ─────────────────────────────────────
    story.append(heading("3.4 Electronic Signatures (21 CFR Part 11)", STYLES["H2"], level=1))
    story.append(para(
        "The e-signature module captures provider electronic signatures on clinical documents in full compliance with FDA 21 CFR Part 11 and EU eIDAS. Signatures are bound to specific document versions, capture signer intent, use two-factor authentication at the moment of signing, and produce non-repudiable records with timestamp-authority-anchored timestamps."
    ))
    story.append(heading("Regulatory Mapping", STYLES["H3"], level=2))
    story.append(bullets([
        "<b>21 CFR Part 11</b>: §11.50 (signature manifestations — name, date/time, meaning), §11.70 (signature + record linking — cannot be excised), §11.200(a) (non-biometric — two distinct components), §11.200(b) (biometric), §11.300 (controls).",
        "<b>EU eIDAS Regulation</b>: Article 25 (advanced electronic signature — AdES), Article 26 (qualified e-signature — QES) for highest-assurance workflows.",
        "<b>HIPAA</b>: 45 CFR 164.530(b) (signatures — required for designated record sets).",
        "<b>EU MDR</b>: Annex I §17.2 + Article 16 (economic-operator signatures on declarations of conformity).",
        "<b>ISO 13485:2016</b>: §4.2.4 (records — signature requirements).",
        "<b>ESIGN Act (US)</b>: Pub.L. 106-229 (electronic signatures in commerce).",
        "<b>Uniform Electronic Transactions Act (UETA)</b>: state-level e-signature validity.",
    ]))
    story.append(heading("Technical Implementation Requirements", STYLES["H3"], level=2))
    story.append(bullets([
        "<b>Two-component signing</b>: per §11.200(a), non-biometric e-signatures require two distinct authentication components — (1) a password/passphrase + (2) a TOTP/WebAuthn token presented at the moment of signing. Both verified before the signature is applied.",
        "<b>Signature manifestation</b>: per §11.50, every signed record displays: printed name of signer, date + time of signing (UTC + local), the meaning associated with the signature (e.g., 'approval', 'review', 'authorship', 'responsibility').",
        "<b>Signature–record linking</b>: per §11.70, signatures are cryptographically linked to the exact document version (SHA-256 hash) at the moment of signing — the signature cannot be copied to a different record or removed without breaking the chain.",
        "<b>Intent capture</b>: a pre-signing affirmation ('I attest that this document is accurate and complete to the best of my knowledge') presented + acknowledged before the signature components are collected.",
        "<b>Timestamp Authority (TSA)</b>: RFC 3161 timestamps from a qualified TSA (e.g., DigiCert, Sectigo) anchoring the signature to a verifiable time, providing non-repudiation even if the signer's clock is wrong.",
        "<b>Non-repudiation</b>: signature block includes signer's public-key fingerprint, document hash, timestamp token, and signer's X.509 certificate chain — verifiable independently of the platform.",
        "<b>Document lock</b>: once signed, the document version is immutable; any subsequent edit creates a new version (tracked in the DHF), with the prior signed version retained per §11.10(c).",
        "<b>Re-signing + addendum workflow</b>: a controlled amendment process for post-signature edits — the original signature is preserved, a new version is created, the amendment is re-signed with the same controls.",
        "<b>Audit</b>: every signature event → immutable audit entry (signer, document_id, document_hash_prev, document_hash_post, timestamp_token, signature_meaning, ip, device, mfa_method).",
    ]))
    story.append(heading("Validation & Testing Criteria", STYLES["H3"], level=2))
    story.append(bullets([
        "Two-component: test confirms BOTH components required (password-only → rejected; token-only → rejected; both → accepted).",
        "Manifestation: signed PDF/DOCX displays name + date/time + meaning; verified by manual + automated inspection.",
        "Linking: tamper-with-document test → signature verification fails (hash mismatch); document remains intact + flagged.",
        "Timestamp: TSA token present + verifiable against the TSA's public key.",
        "Non-repudiation: independent verifier (e.g., Adobe Acrobat, DSS) confirms signature validity without platform access.",
        "Amendment: re-sign workflow creates a new version; original signature hash unchanged.",
    ]))
    story.append(heading("Audit & Documentation Requirements", STYLES["H3"], level=2))
    story.append(bullets([
        "Signature policy document (per ETSI EN 319 142) on file; reviewed annually.",
        "Certificate inventory: every signer's X.509 + chain + expiry + revocation status.",
        "TSA SLA + audit attestation on file.",
        "Annual e-signature validation report (per GAMP 5 CSV methodology).",
    ]))
    story.append(PageBreak())

    # ── Module 3.5: Consent Management ───────────────────────────────────────
    story.append(heading("3.5 Consent Management", STYLES["H2"], level=1))
    story.append(para(
        "The consent module captures, stores, and enforces granular patient consent across every jurisdiction. It supports dynamic consent (patients can update preferences at any time), consent revocation workflows with downstream-propagation, and full audit trails satisfying GDPR Article 9 explicit-consent for special-category data and HIPAA authorization requirements."
    ))
    story.append(heading("Regulatory Mapping", STYLES["H3"], level=2))
    story.append(bullets([
        "<b>GDPR</b>: Article 6 (lawful basis), Article 7 (conditions for consent — withdrawable at any time, as easy to withdraw as to give), Article 9 (explicit consent for special-category data including health), Article 13/14 (privacy notices), Recital 32 (informed + specific).",
        "<b>HIPAA</b>: 45 CFR 164.508 (authorization for uses + disclosures of PHI — core elements + required statements), 164.514(d) (data-use agreements for limited data sets).",
        "<b>PIPEDA</b>: Principle 4.3 (consent — express or implied), 4.3.5 (withdrawable).",
        "<b>Australian Privacy Principles</b>: APP 3 (sensitive info — consent), APP 6 (use + disclosure).",
        "<b>EU MDR</b>: Article 4 (informed consent for clinical investigations — ISO 14155).",
        "<b>EHDS (2025/327)</b>: Article 14 (electronic consent for secondary use of health data).",
        "<b>21 CFR Part 50</b>: (US clinical-trial informed consent — applicable to clinical-investigation workflows).",
    ]))
    story.append(heading("Technical Implementation Requirements", STYLES["H3"], level=2))
    story.append(bullets([
        "<b>Granular consent capture</b>: per-purpose, per-recipient, per-data-category, per-time-bound. Consent records are first-class FHIR Consent resources (R4) — queryable, exportable, machine-enforceable.",
        "<b>Dynamic consent</b>: patient-facing portal (web + mobile) lets patients view, update, withdraw any consent at any time; changes propagate to downstream systems within 5 minutes.",
        "<b>Consent revocation</b>: revoking a consent triggers a workflow — downstream data flows stop, the patient's data is flagged for de-identification or erasure (per the consent terms), the patient is notified of completion.",
        "<b>Consent audit trail</b>: every consent event (capture, update, withdrawal, expiry, enforcement-decision) → immutable audit entry. Retained 6 years (HIPAA) / for the data's lifetime (GDPR).",
        "<b>GDPR Article 9 explicit consent</b>: for special-category (health) data processing — affirmative action (checkbox + signature) required; pre-ticked boxes forbidden; bundled consents forbidden.",
        "<b>HIPAA authorization</b>: template authorizations with all 21 required core elements + required statements (164.508(c)); e-signature on the authorization; patient copy retained.",
        "<b>Privacy notices</b>: layered notices (just-in-time + full policy); versioned; localized (all EU languages); displayed at the point of consent.",
        "<b>Cookie consent</b>: GDPR-compliant cookie banner (IAB TCF v2.2); granular per-vendor consent; reject-all as prominent as accept-all.",
    ]))
    story.append(heading("Validation & Testing Criteria", STYLES["H3"], level=2))
    story.append(bullets([
        "Granularity: test that a patient can grant Purpose A while withholding Purpose B; downstream enforcement respects the distinction.",
        "Revocation: revoke → confirm downstream data flows stop within 5min; confirm erasure/de-identification workflow triggered; confirm patient notified.",
        "Explicit consent: pre-ticked-box test → rejected; bundled-consent test → rejected.",
        "Localization: every EU official language present + correct.",
        "Audit: consent event → immutable entry within 1s; queryable for 6+ years.",
    ]))
    story.append(heading("Audit & Documentation Requirements", STYLES["H3"], level=2))
    story.append(bullets([
        "Records of processing activities (GDPR Article 30) — per-purpose, per-data-category, with lawful basis cited.",
        "DPIA (Article 35) for high-risk processing — on file; reviewed annually.",
        "Privacy notice version history — every version retained.",
        "Consent-management policy + procedure document (per ISO 27701).",
    ]))
    story.append(PageBreak())

    # ── Module 3.6: Data Subject Rights ──────────────────────────────────────
    story.append(heading("3.6 Data Subject Rights (DSR)", STYLES["H2"], level=1))
    story.append(para(
        "The DSR module operationalizes patient rights under GDPR Articles 15–22, HIPAA 164.524/526/528, PIPEDA Principle 9, and Australian APP 12/13. It provides a patient portal for rights exercise, automated data-portability exports (FHIR Bulk Data), rectification workflows, erasure with legal-hold exceptions, restriction, and objection handling — all within statutory deadlines."
    ))
    story.append(heading("Regulatory Mapping", STYLES["H3"], level=2))
    story.append(bullets([
        "<b>GDPR Article 15</b> (access), <b>16</b> (rectification), <b>17</b> (erasure), <b>18</b> (restriction), <b>20</b> (portability), <b>21</b> (objection), <b>22</b> (automated decision-making).",
        "<b>HIPAA</b>: 45 CFR 164.524 (access of individuals), 164.526 (amendment), 164.528 (accounting of disclosures).",
        "<b>PIPEDA</b>: Principle 9 (individual access), Principle 4.9 (challenging compliance).",
        "<b>Australian APP 12</b> (access), <b>APP 13</b> (correction).",
        "<b>CCPA/CPRA</b>: §1798.100 (access), §1798.105 (deletion), §1798.110 (portability).",
        "<b>EUDR</b>: (under EHDS) patient access to electronic health records.",
    ]))
    story.append(heading("Technical Implementation Requirements", STYLES["H3"], level=2))
    story.append(bullets([
        "<b>Patient access portal</b>: self-service portal + API (FHIR $everything operation) returning the patient's full record within statutory deadlines (GDPR 1 month; HIPAA 30 days + 30-day extension).",
        "<b>Data portability</b>: FHIR Bulk Data ($export) — NDJSON format, downloadable as a signed bundle; supports machine-to-machine transfer to another provider.",
        "<b>Rectification workflow</b>: patient-submitted correction request → routed to the originating provider for clinical review → applied (or denied with reason) → patient notified within 60 days (HIPAA) / 1 month (GDPR).",
        "<b>Erasure</b>: 'right to be forgotten' — hard-delete or de-identify on consent withdrawal, EXCEPT where legal-hold, retention law, or ongoing-care obligations require retention. Legal-hold flag checked before any erasure.",
        "<b>Restriction</b>: flag the record as restricted (processing paused, storage continues) — used during rectification disputes or objection investigations.",
        "<b>Objection</b>: patient objection to processing (e.g., marketing, secondary research) → processing stops unless compelling legitimate grounds.",
        "<b>Automated decision-making</b>: per Article 22, no solely-automated decisions with legal/significant effect on the patient without explicit consent or public-interest basis; human-in-the-loop for all AI-assisted clinical content (per the MedFlow product rules).",
        "<b>Identity verification</b>: DSR requester identity verified (MFA + identity-proofing per NIST 800-63A IAL2) before any data release.",
    ]))
    story.append(heading("Validation & Testing Criteria", STYLES["H3"], level=2))
    story.append(bullets([
        "Access: DSR submitted → data returned within 30 days; format = FHIR Bundle + PDF.",
        "Portability: $export returns complete NDJSON; machine-readable; signed.",
        "Erasure: erasure → verify hard-delete across all stores (DB, object storage, backups after retention cycle, search index, analytics warehouse); verify legal-hold blocks erasure.",
        "Rectification: correction workflow → provider review → patient notification within SLA.",
        "Identity: unverified requester → denied; verified → data released.",
    ]))
    story.append(heading("Audit & Documentation Requirements", STYLES["H3"], level=2))
    story.append(bullets([
        "DSR log: every request (date, requester, right exercised, outcome, SLA met/missed) retained 6 years.",
        "Erasure certificate: for each erasure, a signed certificate listing what was deleted + what was retained + the legal basis for retention.",
        "Annual DSR report to the privacy officer.",
    ]))
    story.append(PageBreak())


def build_advanced_security(story):
    story.append(heading("4. Advanced Security & Privacy Features", STYLES["H1"], level=0))
    story.append(para(
        "Beyond the core compliance foundation, Tier 2 and Tier 3 deployments add defense-in-depth layers covering privacy by design, threat protection, data loss prevention, Zero Trust architecture, and a secure development lifecycle. These features satisfy ISO 27001, NIS2, HITRUST CSF, and SOC 2 trust principles, and provide the technical safeguards required for EU MDR cybersecurity (Annex I §17)."
    ))

    story.append(heading("4.1 Privacy by Design", STYLES["H2"], level=1))
    story.append(para(
        "Privacy by design (GDPR Article 25; ISO 27701) is embedded into every system component from requirements through retirement. Data minimization limits collection to what's necessary for the stated purpose. Purpose limitation prevents reuse beyond the patient's consent. Storage limitation enforces retention schedules. Privacy impact assessments (DPIAs) are mandatory for all new high-risk processing. Privacy notices are layered + localized. Cookie consent follows IAB TCF v2.2."
    ))
    story.append(bullets([
        "<b>Data minimization</b>: schema review at design time — every field justified against a documented purpose; PII fields flagged + minimized in non-production environments via de-identification (Safe Harbor + Expert Determination per HIPAA 164.514).",
        "<b>Pseudonymization</b>: direct identifiers (name, MRN) tokenized in analytics + AI-training datasets; re-identification keys held separately under HSM control.",
        "<b>DPIA</b>: mandatory for: large-scale health-data processing, AI/ML on PHI, cross-border transfers, new data-sharing with third parties. DPIA template per WP29 (now EDPB) Guidelines on DPIA.",
        "<b>Storage limitation</b>: per-data-category retention schedule; auto-deletion at expiry; legal-hold exceptions documented.",
        "<b>Cookie consent</b>: IAB TCF v2.2-compliant banner; reject-all = same prominence as accept-all; granular per-vendor; versioned consent records.",
    ]))

    story.append(heading("4.2 Threat Protection", STYLES["H2"], level=1))
    story.append(para(
        "Threat protection layers defend against external attacks and internal misuse. A Web Application Firewall (WAF) with OWASP rulesets, DDoS mitigation, intrusion detection/prevention (IDS/IPS), endpoint detection and response (EDR), and scheduled penetration testing form a multi-layer defense aligned to NIST CSF + ISO 27001 Annex A.8 controls."
    ))
    story.append(bullets([
        "<b>WAF</b>: managed rules (AWS WAF / Azure Front Door / Cloudflare) — OWASP Top 10, SQLi, XSS, bot-control, rate-limiting; custom rules for PHI-specific patterns.",
        "<b>DDoS mitigation</b>: edge protection (Cloudflare / AWS Shield Advanced); SYN-flood + amplification defense; 7-day incident-response SLA.",
        "<b>IDS/IPS</b>: network-based (Suricata / Snort) + host-based (Wazuh / Falco); signature + anomaly detection; alerts to SOC.",
        "<b>EDR</b>: CrowdStrike Falcon / Microsoft Defender for Endpoint on all endpoints; 24/7 SOC monitoring (Tier 3).",
        "<b>Vulnerability scanning</b>: continuous (Qualys / Tenable) — weekly internal, monthly external; CVSS ≥ 7.0 patched within 7 days; ≥ 9.0 within 24h.",
        "<b>Penetration testing</b>: annual third-party (CREST/OSCP); scope covers external, internal, app, API, mobile, social engineering.",
    ]))

    story.append(heading("4.3 Data Loss Prevention (DLP)", STYLES["H2"], level=1))
    story.append(para(
        "DLP policies prevent exfiltration of PHI via email, file shares, removable media, clipboard, and screenshots. Policies are content-aware (using SNOMED/ICD pattern matching + ML classifiers for PHI) and enforce least-resistance remediation (encrypt-before-send, block, or warn)."
    ))
    story.append(bullets([
        "<b>Email DLP</b>: outbound email scanned for PHI patterns (MRN, SSN, ICD codes, clinical terms); encrypt-before-send to external recipients; quarantine for review.",
        "<b>Attachment scanning</b>: documents + images OCR'd + scanned for PHI; matched policies enforce encryption/block.",
        "<b>USB/port controls</b>: endpoint agent blocks USB mass storage (read-only or full block); clipboard restrictions in VDI sessions; screenshot blocking on PHI views (where supported).",
        "<b>Watermarking</b>: every PHI-bearing document + screen view watermarked with actor_id + timestamp (visible + invisible); deters leaks + enables traceability.",
    ]))

    story.append(heading("4.4 Zero Trust Architecture", STYLES["H2"], level=1))
    story.append(para(
        "Zero Trust (NIST SP 800-207) assumes no implicit trust — every access request is verified explicitly, the blast radius of any compromise is minimized via micro-segmentation, and device trust is continuously validated. The network is treated as hostile; identity + device posture gate every request."
    ))
    story.append(bullets([
        "<b>Micro-segmentation</b>: per-workload network policies (Calico / Cilium); default-deny; east-west traffic encrypted (mTLS via service mesh — Istio/Linkerd).",
        "<b>Least privilege</b>: just-in-time elevation (no standing admin); break-glass for emergencies; time-boxed + audited.",
        "<b>Continuous verification</b>: every API request re-evaluates RBAC + ABAC + device-trust + risk-score; session token short-lived (5 min).",
        "<b>Device trust</b>: MDM-enrolled devices only (Intune / Jamf); posture check (disk encryption, EDR running, OS patched) before access granted.",
        "<b>NAC</b>: 802.1X for on-prem network; certificate-based device identity; non-compliant devices quarantined.",
    ]))

    story.append(heading("4.5 Secure Development Lifecycle (SDLC)", STYLES["H2"], level=1))
    story.append(para(
        "The SDLC embeds security into every phase — from requirements through deployment. Static + dynamic analysis, dependency scanning, secrets management, code signing, SBOM generation, and DevSecOps pipelines ensure that security is continuous, not a final gate. This satisfies ISO 27001 Annex A.8.25, NIS2 Article 21(2)(f), and EU MDR cybersecurity guidance (MDCG 2019-16)."
    ))
    story.append(bullets([
        "<b>SAST</b>: SonarQube / Semgrep on every PR; 0 criticals before merge.",
        "<b>DAST</b>: OWASP ZAP + Burp Suite on every staging deploy; weekly automated scans.",
        "<b>IAST</b>: runtime instrumentation (Contrast Security) in pre-prod.",
        "<b>Dependency scanning</b>: Snyk / Dependabot — daily; CVE remediation within SLA (critical 24h, high 7d).",
        "<b>Secrets management</b>: HashiCorp Vault / AWS Secrets Manager — no secrets in code or env; rotation automated.",
        "<b>Code signing</b>: Sigstore (cosign) for container images + SLSA Level 3 provenance.",
        "<b>SBOM</b>: CycloneDX SBOM generated per release; published to a dependency-track instance; vulnerability monitoring continuous.",
        "<b>DevSecOps pipeline</b>: CI/CD with security gates (SAST, SCA, container scan, IaC scan, secret scan); failing gate blocks deploy.",
    ]))
    story.append(PageBreak())


def build_clinical_safety(story):
    story.append(heading("5. Clinical Safety & Risk Management", STYLES["H1"], level=0))
    story.append(para(
        "For Tier 3 deployments operating as or adjacent to a medical device, the clinical safety module implements ISO 14971 risk management, clinical decision support, predictive risk stratification, adverse-event reporting, medication safety, and incident management. These features satisfy EU MDR Annex I + II + III, FDA SaMD guidance, and WHO patient-safety guidelines."
    ))

    story.append(heading("5.1 Clinical Decision Support (CDS)", STYLES["H2"], level=1))
    story.append(para(
        "CDS provides evidence-based alerts + recommendations at the point of care. CDS rules are versioned, clinically validated, and aligned to the FDA CDS guidance (4 criteria) + EU MDR Rule 11 (SaMD classification). Every alert is auditable; override reasons captured."
    ))
    story.append(bullets([
        "<b>CDS rules</b>: drug-drug interaction (Lexicomp / First Databank), drug-allergy, duplicate therapy, renal-dosing (Cockcroft-Gault / CKD-EPI), geriatric-dosing (Beers Criteria), clinical pathways (per specialty).",
        "<b>Rule versioning</b>: every rule version retained; effective dates; clinical-evidence citation (guideline + version); rollback capability.",
        "<b>Override capture</b>: clinician override requires a reason-code (SNOMED CT) + free-text; overrides audited + trended.",
        "<b>Alert fatigue mitigation</b>: tiered severity; suppressible by user/specialty; ML-based relevance ranking.",
    ]))

    story.append(heading("5.2 Risk Stratification", STYLES["H2"], level=1))
    story.append(para(
        "Predictive analytics identify patients at risk of deterioration, readmission, sepsis, or other adverse outcomes. Models are FDA-cleared where required (predetermined-change-control plan for AI/ML SaMD), clinically validated, bias-tested, and drift-monitored."
    ))
    story.append(bullets([
        "<b>Readmission risk</b>: LACE+ / HOSPITAL score + custom ML model; daily refresh; intervention workflow.",
        "<b>Sepsis detection</b>: SIRS + qSOFA + custom ML (AUC tracked); alert to rapid-response team.",
        "<b>Deterioration scoring</b>: NEWS2 (UK) / MEWS / PEWS (pediatric); continuous vitals monitoring; escalation protocol.",
        "<b>Population health risk</b>: hierarchical condition categories (HCC) + chronic-disease registries; care-gap analysis.",
    ]))

    story.append(heading("5.3 Adverse Event Reporting", STYLES["H2"], level=1))
    story.append(para(
        "Automated detection + reporting of adverse events (AE) and serious adverse events (SAE) to FDA MedWatch, EMA EudraVigilance, and national authorities. Signal-detection algorithms identify emerging safety concerns."
    ))
    story.append(bullets([
        "<b>AE/SAE detection</b>: structured capture + NLP on clinical narratives; severity grading (CTCAE); causality assessment.",
        "<b>FDA MedWatch</b>: automated Form 3500/3500A generation + e-submission (ESG).",
        "<b>EudraVigilance</b>: E2B(R3) ICSR + EVPM submission; EV code registration.",
        "<b>Signal detection</b>: disproportionality analysis (PRR, ROR, BCPNN) on the cumulative safety database; monthly review.",
    ]))

    story.append(heading("5.4 Medication Safety", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>ePrescribing</b>: NCPDP SCRIPT; EPCS (electronic prescribing of controlled substances) per DEA 21 CFR 1300 + 1311 — two-factor token + audit.",
        "<b>PDMP integration</b>: state Prescription Drug Monitoring Program query before controlled-substance prescribing.",
        "<b>BCMA</b>: barcode medication administration — 5 rights verified at administration; closed-loop.",
    ]))

    story.append(heading("5.5 Incident Management (CAPA)", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>Root cause analysis</b>: 5-Whys / fishbone / FMEA templates; documented in the QMS.",
        "<b>CAPA tracking</b>: corrective + preventive actions; effectiveness verification; closure by QA.",
        "<b>Non-conformance reporting</b>: ISO 13485 §8.3 + §8.5.2; trended + reviewed in management review.",
    ]))
    story.append(PageBreak())


def build_interoperability(story):
    story.append(heading("6. Interoperability & Data Exchange", STYLES["H1"], level=0))
    story.append(para(
        "The interoperability module provides standards-based exchange across the healthcare ecosystem — FHIR R4/R5, HL7 v2.x, DICOM, X12, IHE profiles, and the major terminology systems. Compliance with CMS/ONC interoperability rules (45 CFR 170), TEFCA, and DirectTrust enables participation in national + international health information exchange."
    ))

    story.append(heading("6.1 FHIR Server (R4/R5)", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>FHIR R4 full compliance</b>: US Core 3.1.1 + 6.1.0 profiles; ONC §170.315(g)(10) certification; FHIR R5 readiness track.",
        "<b>RESTful API</b>: CRUD on all resources; version-aware (ETag); _include/_revinclude; _summary; _elements; search with chaining/revinclude.",
        "<b>SMART on FHIR</b>: OAuth 2.0 + OpenID Connect app launch; scopes (patient/*.read, user/*.write); asymmetric-launch + backend-services (client-credentials).",
        "<b>FHIR Subscriptions</b>: R4 Subscription + R5 SubscriptionTopic (rest-hook + websocket) for real-time notifications.",
        "<b>Bulk Data</b>: $export (group, patient, system) — NDJSON; signed; async + paged; ONC Bulk Data v2.0.",
    ]))

    story.append(heading("6.2 HL7 v2 Interface Engine", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>Message types</b>: ADT (A01-A08, A31-A40), ORM (O01 — orders), ORU (R01 — results), MDM (T02 — document notifications), DFT (P03 — billing).",
        "<b>Parsing + validation</b>: per HL7 2.5.1 + 2.7; field-level validation; Z-segment support; charset handling.",
        "<b>ACK/NACK</b>: commit-level + application-level; AA (accept), AE (error), AR (reject); retry on transient failure.",
        "<b>Transformation maps</b>: v2 → FHIR (HL7 v2-to-FHIR DFT mapping); MDM → DocumentReference; ORU → DiagnosticReport.",
        "<b>Interface monitoring</b>: per-interface dashboards (volume, errors, latency); alerting on error-rate >2%.",
    ]))

    story.append(heading("6.3 DICOM Integration", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>DICOM Storage SCP/SCU</b>: DICOM 3.0; C-STORE, C-FIND, C-MOVE, C-GET; TLS + AE-titles.",
        "<b>DICOMweb</b>: QIDO-RS (query), WADO-RS (retrieve), STOW-RS (store); RS-regulated imaging exchange.",
        "<b>De-identification</b>: DICOM PS3.15 Annex E (de-identification); Safe Harbor option; re-identification keys under HSM control.",
        "<b>Viewer integration</b>: OHIF Viewer + Cornerstone.js; zero-footprint; diagnostic-quality (21 CFR Part 11 + IEC 62304 for diagnostic display).",
    ]))

    story.append(heading("6.4 Terminology Services", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>SNOMED CT</b>: International + US edition; SNOMED CT Expression Constraint + query; ECL search.",
        "<b>LOINC</b>: lab + clinical observations; RELMA mapping; latest release.",
        "<b>ICD-10-CM/PCS + ICD-11</b>: coding + grouping; WHO + NCHS updates.",
        "<b>RxNorm + NDC</b>: medication coding; drug-class hierarchies; interaction lookups.",
        "<b>CPT / HCPCS</b>: American Medical Association licensing + updates; X12 837 billing integration.",
        "<b>Cross-mapping</b>: SNOMED↔ICD-10, LOINC↔local codes; Reference Set Management (REFSET).",
    ]))

    story.append(heading("6.5 HIE Connectivity", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>DirectTrust</b>: secure messaging (S/MIME); trust-anchor validation; Direct addresses per clinician.",
        "<b>Carequality + CommonWell</b>: national networks; FHIR-based exchange; patient matching (Enterprise Master Patient Index — EMPI).",
        "<b>State HIE interfaces</b>: per-state (eHealth Exchange, SHIN-NY, CalHOP, etc.); FHIR or IHE profiles.",
        "<b>TEFCA</b>: Trusted Exchange Framework + Common Agreement; QHIN (Qualified Health Information Network) participation roadmap.",
        "<b>IHE profiles</b>: XDS.b (cross-enterprise document sharing), XCA (cross-community access), MHD (mobile access to health documents).",
    ]))
    story.append(PageBreak())


def build_qms(story):
    story.append(heading("7. Quality Management & Regulatory Documentation", STYLES["H1"], level=0))
    story.append(para(
        "The QMS module implements ISO 13485:2016 document control + design controls, computer system validation (CSV) per GAMP 5, post-market surveillance (PMS/PMCF) per EU MDR, audit readiness for FDA/Notified-Body inspections, and role-based training management. This module is the regulatory spine for Tier 3 medical-device deployments."
    ))

    story.append(heading("7.1 QMS Integration (ISO 13485)", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>Document control</b>: ISO 13485 §4.2.4 — controlled documents with version, effective date, approval, review cycle, obsolescence; e-signature on approvals; revision history.",
        "<b>DHF</b>: Design History File — design inputs, outputs, verification, validation, design changes, design transfer, design history (21 CFR 820.30 + ISO 13485 §7.3).",
        "<b>DMR</b>: Device Master Record — specifications, production processes, QA procedures, labeling, packaging.",
        "<b>DHR</b>: Device History Record — per-unit production records, inspection records, lot traceability.",
        "<b>Change control</b>: ISO 13485 §7.3.9 — change requests, impact assessment, approval matrix, implementation + verification.",
    ]))

    story.append(heading("7.2 Validation & Verification (CSV)", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>GAMP 5</b>: risk-based CSV; categorization (Category 1-5); validation effort ∝ risk + complexity.",
        "<b>IQ/OQ/PQ</b>: Installation Qualification (environment), Operational Qualification (functional), Performance Qualification (end-to-end workflow). Templates + execution records.",
        "<b>Test case management</b>: traceability matrix (requirement → test → evidence); pass/fail + deviation handling.",
        "<b>Validation summary report</b>: per-release; signed by QA + business owner; archived in the QMS.",
    ]))

    story.append(heading("7.3 Post-Market Surveillance", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>PMS plan</b>: EU MDR Annex III — proactive + reactive monitoring; metrics; review cadence.",
        "<b>PMCF</b>: Post-Market Clinical Follow-up — clinical data collection to confirm benefit-risk profile; PMCF plan + evaluation report (Annex XIV Part B).",
        "<b>Complaint handling</b>: ISO 13485 §8.2.2 + 21 CFR 820.198 — intake, triage, investigation, MDR decision (FDA 806 + 803), closure.",
        "<b>PSUR</b>: Periodic Safety Update Report (EU MDR Article 86) — annual; trend analysis; submitted to the Notified Body.",
    ]))

    story.append(heading("7.4 Audit Readiness", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>Evidence repository</b>: always-on, inspection-ready; mapped to ISO 13485 + 21 CFR 820 + GDPR + ISO 27001 clauses.",
        "<b>Mock audits</b>: semi-annual internal + annual external (simulated FDA / Notified Body); findings → CAPA.",
        "<b>Inspection response</b>: templates for FDA Form 483, EIR, EU MDR non-conformity; on-demand evidence export.",
    ]))

    story.append(heading("7.5 Training Management", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>Role-based training matrices</b>: per-role curriculum (HIPAA, GDPR, ISO 13485, device-specific); onboarding + annual refresh.",
        "<b>Competency assessment</b>: scored assessments; pass threshold; remediation; documented.",
        "<b>Continuing education</b>: CE credits tracked for licensed roles; integration with CE provider systems.",
    ]))
    story.append(PageBreak())


def build_bcdr(story):
    story.append(heading("8. Business Continuity & Disaster Recovery", STYLES["H1"], level=0))
    story.append(para(
        "The BCDR module ensures the platform survives + recovers from disruptions — from a single-component failure to a regional disaster. Multi-AZ high availability, automated geo-redundant backups, a documented DR runbook, and breach-notification workflows satisfy HIPAA 164.308(a)(7), GDPR Article 32, ISO 27001 Annex A.5.29–A.5.30, and EU MDR availability requirements."
    ))

    story.append(heading("8.1 High Availability", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>Multi-AZ</b>: deployed across ≥3 availability zones; automatic failover for stateless services; RPO ≤ 0 for synchronous-replica databases.",
        "<b>Auto-scaling</b>: horizontal scaling on CPU/RPS; predictive scaling for known peaks (morning census).",
        "<b>Load balancing</b>: L7 (ALB) + L4 (NLB) with health checks + circuit breakers; graceful degradation.",
        "<b>Database replication</b>: synchronous (within region) + asynchronous (cross-region); read replicas for reporting; automated failover (RDS Multi-AZ / Aurora Global Database).",
    ]))

    story.append(heading("8.2 Backup & Recovery", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>Schedule</b>: daily incremental + weekly full + continuous WAL streaming; point-in-time recovery to any second in the last 35 days.",
        "<b>Geo-redundant storage</b>: backups copied cross-region (≥500mi separation); immutable (Object Lock Compliance mode).",
        "<b>Integrity testing</b>: monthly automated restore-test (random backup) → checksum verification → documented.",
        "<b>RTO/RPO SLAs</b>: critical systems RTO ≤ 1h, RPO ≤ 15min; non-critical RTO ≤ 4h, RPO ≤ 4h.",
    ]))

    story.append(heading("8.3 Disaster Recovery", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>DR site</b>: warm-standby in a second region; infrastructure-as-code (Terraform); 1-click failover with runbook.",
        "<b>DR runbook</b>: roles + responsibilities, decision tree, escalation contacts, regional + sovereign-cloud fallback (for EU data residency).",
        "<b>Failover testing</b>: semi-annual game-day; documented results; improvements → backlog.",
        "<b>Sovereign cloud option</b>: EU deployments on EU-sovereign clouds (OVHcloud, Scaleway, or AWS EU regions with Schrems-II-compliant SCCs).",
    ]))

    story.append(heading("8.4 Incident Response", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>IR playbooks</b>: per-incident-type (ransomware, data exfiltration, insider, misconfiguration, vendor compromise); NIST SP 800-61r2.",
        "<b>Breach notification workflows</b>: HIPAA — 60 days to affected individuals + HHS + media (≥500 in a state); GDPR — 72h to the supervisory authority + affected data subjects without undue delay; state laws (CCPA 45 days).",
        "<b>Forensic preservation</b>: automated snapshot + chain-of-custody; forensics partner on retainer.",
        "<b>Post-incident review</b>: blameless postmortem within 14 days; root cause; CAPA; report to the security steering committee.",
    ]))
    story.append(PageBreak())


def build_analytics(story):
    story.append(heading("9. Analytics & Reporting", STYLES["H1"], level=0))
    story.append(para(
        "The analytics module produces regulatory reports (CMS quality measures, HEDIS, NHSN), operational dashboards, population-health analytics, and audit analytics. All analytics run on de-identified or pseudonymized data to minimize PHI exposure in the analytics layer."
    ))

    story.append(heading("9.1 Regulatory Reporting", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>CMS quality measures</b>: MIPS (Merit-based Incentive Payment System), QPP (Quality Payment Program); eCQM submission via QRDA-III.",
        "<b>HEDIS</b>: NCQA measures; hybrid + administrative measure collection; annual submission.",
        "<b>UDS</b>: Uniform Data System (HRSA-funded health centers).",
        "<b>State cancer-registry reporting</b>: NAACCR format; standardized abstracts.",
        "<b>NHSN</b>: CDC National Healthcare Safety Network — HAI (healthcare-associated infection) surveillance.",
    ]))

    story.append(heading("9.2 Operational Dashboards", STYLES["H2"], level=1))
    story.append(bullets([
        "Real-time census + bed management; OR utilization; ED throughput; length-of-stay; 30-day readmission rates.",
        "Configurable per role; exportable (CSV/PDF); scheduled email reports.",
    ]))

    story.append(heading("9.3 Population Health", STYLES["H2"], level=1))
    story.append(bullets([
        "Risk stratification dashboards; care-gap analysis; chronic-disease registries (diabetes, CHF, COPD, CKD).",
        "<b>SDOH tracking</b>: social determinants of health (Z-codes; food insecurity, housing, transportation); referrals to community resources.",
    ]))

    story.append(heading("9.4 Audit Analytics", STYLES["H2"], level=1))
    story.append(bullets([
        "Access-pattern analysis (UEBA); unusual-access detection; privilege-escalation monitoring; data-export tracking; break-glass review.",
        "Monthly audit-summary report; quarterly compliance-committee review.",
    ]))
    story.append(PageBreak())


def build_patient_engagement(story):
    story.append(heading("10. Patient Engagement & Accessibility", STYLES["H1"], level=0))
    story.append(para(
        "The patient-engagement module delivers a HIPAA-compliant patient portal, native mobile apps, full accessibility (WCAG 2.1 AA + Section 508), and telehealth integration. These features satisfy the ONC patient-access provisions, GDPR data-portability, and the Australian Digital Health Agency requirements."
    ))

    story.append(heading("10.1 Patient Portal", STYLES["H2"], level=1))
    story.append(bullets([
        "HIPAA-compliant secure messaging; appointment scheduling; bill pay; prescription refills; lab-results viewing (with patient-friendly interpretation).",
        "FHIR-based data access — patient can generate + download their full record (FHIR $everything).",
        "Granular consent management UI; DSR submission (access, rectify, erase).",
    ]))

    story.append(heading("10.2 Mobile Applications", STYLES["H2"], level=1))
    story.append(bullets([
        "iOS + Android; biometric authentication (Face ID / Touch ID / Android BiometricPrompt); offline mode with sync; push notifications (encrypted).",
        "Apple Health + Google Fit integration (with explicit patient consent per data category).",
        "Mobile-app hardening: code obfuscation; root/jailbreak detection; certificate pinning; secure-SDK-key storage (Keystore / Keychain).",
    ]))

    story.append(heading("10.3 Accessibility (WCAG 2.1 AA)", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>WCAG 2.1 Level AA</b>: perceivable (alt-text, captions, contrast ≥ 4.5:1), operable (keyboard nav, no time-limits, skip-links), understandable (consistent nav, error identification), robust (assistive-tech compatible).",
        "<b>Section 508</b> (US federal); <b>EN 301 549</b> (EU public-sector); <b>ACA</b> (Australian Disability Standards).",
        "Screen-reader testing (NVDA, JAWS, VoiceOver, TalkBack); automated axe-core + manual review each release.",
        "Multi-language support: all EU official languages + major APAC languages; RTL (Arabic/Hebrew) layout.",
    ]))

    story.append(heading("10.4 Telehealth Integration", STYLES["H2"], level=1))
    story.append(bullets([
        "HIPAA-compliant video (WebRTC + DTLS-SRTP); virtual waiting room; screen-share; e-prescribing during visit.",
        "<b>RPM</b>: remote patient monitoring — BLE/IEEE 11073 device integration; chronic-care vitals; alerting.",
        "<b>Store-and-forward</b>: async consults (teledermatology, telepathology) with DICOM/image upload.",
    ]))
    story.append(PageBreak())


def build_tiers(story):
    story.append(heading("11. Tiered Compliance Levels", STYLES["H1"], level=0))
    story.append(para(
        "Three compliance tiers provide a progressive adoption path. Each tier builds on the previous — Tier 2 includes all of Tier 1; Tier 3 includes all of Tier 2. Tenants are configured to a tier; the platform enforces tier-appropriate controls + surfaces tier-appropriate features."
    ))

    story.append(heading("Tier 1: Foundation (HIPAA / GDPR Baseline)", STYLES["H2"], level=1))
    story.append(para(
        "Tier 1 establishes the minimum controls required to lawfully process protected health information in any jurisdiction. It is the entry point for all tenants — no PHI may be processed below this tier."
    ))
    story.append(bullets([
        "AES-256 at-rest + TLS 1.3 in-transit encryption; HSM-backed key management.",
        "MFA + RBAC + session management (NIST AAL2).",
        "Immutable audit trail (6-year retention); basic anomaly detection.",
        "Granular consent capture + patient data export (FHIR $everything).",
        "Daily incremental + weekly full backups; standard DR (RTO 4h, RPO 4h).",
        "Standard privacy notices + cookie consent.",
    ]))

    story.append(heading("Tier 2: Advanced (FDA 21 CFR Part 11 + ISO 27001)", STYLES["H2"], level=1))
    story.append(para(
        "Tier 2 adds the controls required for regulated medical-device-adjacent workflows + formalized information security management. Suitable for transcription-service organizations, mid-sized clinics, and any tenant with FDA-regulated documentation."
    ))
    story.append(bullets([
        "21 CFR Part 11 e-signatures with two-component authentication + timestamp authority.",
        "Enhanced audit trails with reason codes (every PHI access requires a 'why'); SIEM integration.",
        "QMS document control (design history file, change control).",
        "Validated development lifecycle (GAMP 5 CSV; IQ/OQ/PQ; traceability matrices).",
        "Advanced threat protection (WAF, IDS/IPS, EDR, vulnerability scanning, annual pentest).",
        "DLP for PHI (email + attachment + USB + watermarking).",
        "Zero Trust architecture (micro-segmentation, mTLS, device trust).",
        "ISO 27001:2022 certified ISMS.",
    ]))

    story.append(heading("Tier 3: Enterprise (EU MDR / IVDR + HITRUST + SOC 2 Type II)", STYLES["H2"], level=1))
    story.append(para(
        "Tier 3 is the full medical-device QMS + clinical-safety + audit-ready posture required for hospitals, health systems, large BPOs, and any deployment operating as or directly adjacent to a medical device. Includes everything from Tier 1 + 2."
    ))
    story.append(bullets([
        "Full ISO 13485:2016 medical-device QMS (DHF, DMR, DHR, design controls).",
        "ISO 14971:2019 clinical risk management (hazard analysis, risk control, benefit-risk evaluation).",
        "Post-market surveillance (PMS/PMCF/PSUR per EU MDR).",
        "Third-party risk management (vendor security assessments; BAA/DPA on every vendor).",
        "Continuous control monitoring (automated control-evidence collection; HITRUST Inheritance + Validation).",
        "Independent third-party audits: HITRUST CSF r2 certification; SOC 2 Type II annual report; ISO 27001 + ISO 13485 certification-body audits; EU MDR Notified-Body conformity assessment.",
        "Sovereign-cloud + data-residency options (EU, Canada, Australia).",
        "24/7 SOC + incident response with sub-hour breach-notification kickoff.",
    ]))
    story.append(PageBreak())


def build_architecture(story):
    story.append(heading("12. Technical Architecture", STYLES["H1"], level=0))
    story.append(para(
        "The architecture is designed for compliance-first operations: defense-in-depth, least-privilege, data-minimization, and sovereign-cloud optionality. Every layer maps to specific regulatory controls and is auditable end-to-end."
    ))

    story.append(heading("12.1 Cloud Infrastructure", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>HIPAA-eligible services</b>: AWS (HHS-eligible: EC2, S3, RDS, Lambda, etc. with BAA); Azure (HIPAA-eligible services with BAA); GCP (HIPAA-eligible with BAA).",
        "<b>BAA execution</b>: signed BAA on file for every cloud + subprocessor; reviewed annually.",
        "<b>Data residency</b>: per-tenant region pinning; EU deployments on EU regions (or sovereign cloud); Canada on Canada Central; Australia on ap-southeast-2.",
        "<b>Sovereign cloud</b>: EU — OVHcloud / Scaleway / AWS EU (Schrems-II SCCs); Russia/China/India — data localization per local law; China — ICP-licensed cloud (AliCloud / Tencent).",
        "<b>Schrems II</b>: Transfer Impact Assessment (TIA) for every US transfer; supplementary measures (encryption + key control in EU).",
    ]))

    story.append(heading("12.2 Container Security", STYLES["H2"], level=1))
    story.append(bullets([
        "Image scanning (Trivy / Snyk) in CI; block on critical CVEs.",
        "Runtime protection (Falco / Aqua); drift detection.",
        "Network policies (Calico / Cilium) — default-deny; mTLS via Istio/Linkerd service mesh.",
        "Secrets management (HashiCorp Vault / AWS Secrets Manager) — no secrets in images or env.",
    ]))

    story.append(heading("12.3 Database Security", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>TDE</b>: transparent data encryption (AES-256) on all DBs.",
        "<b>Row-level security</b>: tenant isolation via Postgres RLS policies (or app-level for non-RLS engines); every query scoped to tenant_id.",
        "<b>Dynamic data masking</b>: column-level masking for PII columns in non-production + analytics.",
        "<b>Database activity monitoring (DAM)</b>: Imperva / native audit — all DML + DDL logged.",
    ]))

    story.append(heading("12.4 API Security", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>OAuth 2.0 + OIDC</b>: authorization-code-with-PKCE for confidential + public clients; client-credentials for backend services; refresh-token rotation.",
        "<b>Rate limiting</b>: per-token + per-IP; 1000 req/min default (configurable); 429 with Retry-After.",
        "<b>Input validation</b>: Zod / Joi schema validation on every endpoint; reject unknown fields; size limits.",
        "<b>API gateway</b>: Kong / AWS API Gateway / Azure APIM — auth, rate-limit, schema-validation, WAF, versioning.",
        "<b>Versioning</b>: URL-path versioning (/v1/, /v2/); deprecation policy; ≥12-month overlap.",
    ]))

    story.append(heading("12.5 Observability", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>Centralized logging</b>: ELK / Splunk / Datadog — all audit events + app logs; 6+ year retention for audit; 30-day hot retention for ops.",
        "<b>Distributed tracing</b>: OpenTelemetry / Jaeger — correlation IDs across services.",
        "<b>Metrics</b>: Prometheus + Grafana — SLIs/SLOs (availability, latency, error-rate); alerting on compliance violations.",
        "<b>Alerting</b>: PagerDuty / Opsgenie — on-call rotation; breach-notification workflow pre-wired.",
    ]))
    story.append(PageBreak())


def build_roadmap(story):
    story.append(heading("13. Implementation Roadmap", STYLES["H1"], level=0))
    story.append(para(
        "A phased rollout plan with milestones, dependencies, and resource estimates. Phases are sequential; each phase's exit criteria must be met before the next begins. Total estimated timeline: 24 months to Tier 3 Enterprise readiness."
    ))
    data = [
        ["Phase", "Duration", "Milestones", "Dependencies", "Effort (FTE-mo)"],
        ["1. Foundation (Tier 1)", "Months 1-6",
         "IAM (MFA+SSO+RBAC); AES-256+TLS 1.3; audit trail (6yr); consent; FHIR export; standard DR",
         "Cloud account + BAA + HSM provisioning", "42"],
        ["2. Hardening (Tier 1→2)", "Months 7-12",
         "21 CFR Part 11 e-sigs; SIEM; QMS doc control; GAMP 5 CSV; WAF+IDS/IPS+EDR; DLP; Zero Trust",
         "Phase 1 exit; ISO 27001 ISMS scope definition", "54"],
        ["3. Interoperability", "Months 9-18 (parallel with 2)",
         "FHIR R4 full + SMART; HL7 v2 engine; DICOM; terminology services; HIE (DirectTrust + Carequality)",
         "Phase 1; IHE / FHIR certification track", "36"],
        ["4. Clinical Safety (Tier 3)", "Months 13-21",
         "ISO 13485 QMS; ISO 14971 risk mgmt; CDS; adverse-event reporting; PMS/PMCF; CAPA",
         "Phase 2 exit; EU MDR classification decision; Notified Body engagement", "48"],
        ["5. Enterprise Hardening", "Months 18-24",
         "HITRUST CSF r2; SOC 2 Type II; multi-region DR; sovereign cloud; 24/7 SOC",
         "Phase 4; controls-evidence automation", "30"],
        ["6. Continuous Compliance", "Ongoing",
         "Annual audits; control monitoring; PMS reports; penetration tests; training refresh",
         "All prior phases", "12 (annual run-rate)"],
    ]
    story.append(make_table(data, [3.4*cm, 2.4*cm, 5.8*cm, 3.4*cm, 2.4*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(callout(
        "Critical-path dependencies: (1) BAA execution with cloud + subprocessors — Month 1; (2) EU MDR device classification decision — Month 6 (gates Phase 4); (3) Notified Body engagement — Month 12 (gates Tier 3 certification); (4) HITRUST readiness assessment — Month 18."
    ))
    story.append(PageBreak())


def build_validation_plan(story):
    story.append(heading("14. Validation Plan", STYLES["H1"], level=0))
    story.append(para(
        "Every feature is validated through five testing layers: functional, security, performance, compliance, and user acceptance. Validation evidence is archived in the QMS for the lifetime of the device + 5 years (21 CFR Part 11) / 10+ years (EU MDR)."
    ))
    data = [
        ["Layer", "Method", "Coverage Target", "Frequency", "Sign-off"],
        ["Functional", "Unit + integration + E2E tests", ">90% code coverage", "Per PR + per release", "Engineering lead"],
        ["Security", "SAST + DAST + IAST + pentest + vuln scan", "OWASP ASVS L2; 0 criticals pre-release", "Per PR (SAST) / per release (DAST) / annual (pentest)", "CISO"],
        ["Performance", "Load + stress + scalability", "P99 latency ≤ 500ms; 1000 RPS sustained", "Per major release", "SRE lead"],
        ["Compliance", "Control validation + audit-trail verification + access-control testing", "100% of controls in the SoA", "Per release + annual", "Compliance Officer"],
        ["User Acceptance", "Clinical-workflow validation + usability with HCPs", "SUS ≥ 75; 0 critical usability issues", "Per major release + pre-launch", "Clinical Product Owner"],
    ]
    story.append(make_table(data, [2.6*cm, 4.5*cm, 4.5*cm, 3.0*cm, 2.6*cm]))
    story.append(Spacer(1, 0.3*cm))
    story.append(para(
        "Sign-off is captured via 21 CFR Part 11 e-signature (two-component) and stored in the validation summary report, which is a controlled document in the QMS. Any deviation from acceptance criteria triggers a non-conformance (ISO 13485 §8.3) and CAPA (§8.5.2)."
    ))
    story.append(PageBreak())


def build_cost_benefit(story):
    story.append(heading("15. Cost-Benefit Analysis", STYLES["H1"], level=0))
    story.append(para(
        "Estimated development effort, third-party audit costs, and ongoing compliance maintenance. Figures are planning estimates in USD; actuals depend on scope, jurisdiction, and the tenant's existing posture."
    ))

    story.append(heading("15.1 One-Time Development + Certification Costs", STYLES["H2"], level=1))
    data = [
        ["Workstream", "Effort (FTE-mo)", "Cost @ $15k/FTE-mo", "Third-Party Cost", "Total"],
        ["Tier 1 Foundation (IAM, encryption, audit, consent, DR)", "42", "$630k", "$50k (BAA legal + pentest)", "$680k"],
        ["Tier 2 Advanced (e-sigs, SIEM, QMS, CSV, Zero Trust)", "54", "$810k", "$120k (ISO 27001 cert)", "$930k"],
        ["Tier 3 Enterprise (ISO 13485, ISO 14971, PMS)", "48", "$720k", "$250k (MDR Notified Body)", "$970k"],
        ["Interoperability (FHIR, HL7 v2, DICOM, HIE)", "36", "$540k", "$40k (IHE Connectathon + ONC cert)", "$580k"],
        ["Enterprise Hardening (HITRUST, SOC 2, DR, SOC)", "30", "$450k", "$180k (HITRUST + SOC 2 audits)", "$630k"],
        ["TOTAL (24-month program)", "210 FTE-mo", "$3.15M", "$640k", "$3.79M"],
    ]
    story.append(make_table(data, [6.5*cm, 2.0*cm, 2.6*cm, 3.2*cm, 2.0*cm]))

    story.append(heading("15.2 Ongoing Annual Compliance Maintenance", STYLES["H2"], level=1))
    data2 = [
        ["Item", "Annual Cost"],
        ["Continuous control monitoring + SIEM licensing", "$180k"],
        ["Annual ISO 27001 + ISO 13485 surveillance audits", "$90k"],
        ["Annual HITRUST re-certification + SOC 2 Type II", "$140k"],
        ["Annual penetration test + vulnerability scanning", "$80k"],
        ["EU MDR PSUR + Notified Body surveillance", "$60k"],
        ["Training + competency refresh (workforce-wide)", "$70k"],
        ["24/7 SOC (managed service, Tier 3)", "$320k"],
        ["Legal + DPO + Privacy Counsel (retainer)", "$120k"],
        ["TOTAL annual run-rate", "$1.06M"],
    ]
    story.append(make_table(data2, [9.0*cm, 4.5*cm]))

    story.append(heading("15.3 Benefits", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>Market access</b>: Tier 3 unlocks US hospital + health-system + EU member-state + Canadian provincial + Australian public-sector procurement — markets collectively worth >$50B/yr in medical-transcription BPO spend.",
        "<b>Risk reduction</b>: HIPAA penalties (up to $1.5M/year per violation category); GDPR fines (up to 4% of global turnover); EU MDR non-compliance (product withdrawal + fines). Robust controls reduce breach probability by an estimated 60-80% (per HITRUST Alliance data).",
        "<b>Operational efficiency</b>: validated workflows + automated evidence collection reduce audit-prep time by ~70% (from ~6 weeks to ~2 weeks per audit cycle).",
        "<b>Trust + competitive differentiation</b>: HITRUST + SOC 2 + ISO 13485 certifications are competitive differentiators in healthcare BPO RFPs — shortlist-pre-qualification criteria.",
    ]))
    story.append(PageBreak())


def build_additional(story):
    story.append(heading("16. Additional Considerations", STYLES["H1"], level=0))

    story.append(heading("16.1 AI / ML Compliance", STYLES["H2"], level=1))
    story.append(para(
        "MedFlow uses AI for speech-to-text transcription, document structuring, and quality analysis. These are classified as 'decision-support' SaMD (FDA SaMD risk category Class II for the QA/risk-detection features) and as 'high-risk' AI systems under the EU AI Act (Annex III — biometric + health data). The following controls apply:"
    ))
    story.append(bullets([
        "<b>FDA AI/ML SaMD Action Plan</b> (2021): predetermined-change-control plan (PCCP) for model updates; good machine-learning practice (GMLP); algorithm transparency; performance monitoring; post-labeling feedback loop.",
        "<b>EU AI Act</b>: high-risk classification (Annex III #5 — health); risk-management system (Article 9, ISO 14971-aligned); data governance (Article 10 — training data quality + bias mitigation); transparency (Article 13); human oversight (Article 14); accuracy + robustness (Article 15); post-market monitoring (Article 72).",
        "<b>Bias testing</b>: subgroup performance (demographic parity, equalized odds) across age, sex, race, language, accent; documented per model release.",
        "<b>Model drift monitoring</b>: input-distribution + output-distribution drift detection; alerting; auto-rollback on threshold breach.",
        "<b>Algorithm transparency</b>: model card (architecture, training data, performance, limitations, intended use); published to the patient portal on request.",
        "<b>Human-in-the-loop</b>: per MedFlow product rules — AI never marks a document clinically final; every clinical document requires an authorized human provider's e-signature.",
    ]))

    story.append(heading("16.2 IoT / Connected Medical Device Integration", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>FDA cybersecurity guidance</b> (2023): premarket + postmarket cybersecurity management; SBOM for device software; threat modeling; cybersecurity testing.",
        "<b>MDCG 2019-16</b>: EU MDR cybersecurity guidance; risk-based approach; security-by-design.",
        "<b>IEEE 11073</b>: medical-device communication standards (vitals, glucometers, etc.); plug-and-play.",
        "<b>Vulnerability disclosure</b>: coordinated-disclosure policy; CVE assignment; 90-day disclosure window; security advisory channel.",
        "<b>Software update mechanisms</b>: signed updates; rollback; change-log; adverse-event reporting if update causes a safety issue.",
    ]))

    story.append(heading("16.3 Cross-Border Data Transfers", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>GDPR Chapter V</b>: Standard Contractual Clauses (SCCs 2021/914) + Transfer Impact Assessment (TIA) per Schrems II; Binding Corporate Rules (BCRs) as an alternative for intra-group transfers.",
        "<b>Data localization</b>: Russia (Federal Law 242-FZ — personal data of Russian citizens must be stored in Russia); China (PIPL — cross-border transfer requires security assessment by the CAC); India (DPDP Act 2023 — cross-border restrictions on notice).",
        "<b>EU sovereign cloud option</b>: Gaia-X-aligned clouds (OVHcloud, Scaleway, Ionos) for EU health data; Schrems-II-compliant without supplementary measures.",
        "<b>US Executive Order 14086</b>: revised signal-intelligence safeguards; reviewed per TIA.",
        "<b>UK adequacy</b>: UK GDPR + Data Protection Act 2018; UK-IDTA + International Data Transfer Agreement for non-adequate countries.",
    ]))

    story.append(heading("16.4 Emerging Regulations (Forward-Looking)", STYLES["H2"], level=1))
    story.append(bullets([
        "<b>EU AI Act</b> (in force 2024, phased application through 2027): high-risk AI systems — risk management, data governance, transparency, human oversight, post-market monitoring. MedFlow AI features fall under Annex III high-risk category.",
        "<b>US ADPPA</b> (American Data Privacy + Protection Act — if enacted): federal privacy law preempting state laws (except CCPA + a few others); compliance track prepared.",
        "<b>State privacy laws</b>: CCPA/CPRA (California), VCDPA (Virginia), CTDPA (Connecticut), CPA (Colorado), UCPA (Utah) — all generally aligned; per-state consent + DSR workflows supported.",
        "<b>WHO Pandemic Treaty digital-health provisions</b>: (under negotiation) — digital-health infrastructure + data-sharing for pandemic preparedness; design-for-interoperability principle applied.",
        "<b>EUDR + EHDS</b>: EU Deforestation Regulation (supply-chain due diligence — not directly applicable, but ESG-screening for cloud-hardware supply chain); European Health Data Space (Reg. 2025/327) — health-data secondary use governance; roadmap to Tier 3 EHDS compliance by 2027.",
        "<b>EU Cyber Resilience Act (CRA)</b>: cybersecurity requirements for products with digital elements (including medical-device software with connectivity); overlaps with EU MDR + NIS2; CE-marking implications.",
    ]))

    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        "<b>Disclaimer:</b> This specification provides technical + architectural guidance for building a compliance-capable healthcare platform. It is not legal advice. Regulatory requirements evolve; engage qualified regulatory counsel (privacy, FDA, EU MDR) for jurisdiction-specific compliance determinations. Citations reference the regulation as of the document date; verify currency before relying on a specific section number.",
        STYLES["Disclaimer"]))


# ============================================================================
# MAIN BUILD
# ============================================================================

def main():
    output_path = "/home/z/my-project/download/MedFlow_Compliance_Specification.pdf"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = TocDocTemplate(
        output_path,
        pagesize=A4,
        title="MedFlow Transcribe AI — Global Healthcare Compliance Specification",
        author="MedFlow Transcribe AI",
        subject="Enterprise Regulatory Compliance Specification (HIPAA, GDPR, EU MDR, ISO 13485/27001, HITRUST, SOC 2)",
        creator="MedFlow Transcribe AI",
    )

    story = []
    # Cover
    build_cover(story)
    # Switch to Body template for the rest
    from reportlab.platypus import NextPageTemplate
    # Actually the cover is page 1; we need to switch to Body template AFTER the cover.
    # Rebuild story with NextPageTemplate.

    story = []
    story.append(NextPageTemplate("Body"))
    build_cover(story)
    # After the cover PageBreak, switch to Body
    story.append(NextPageTemplate("Body"))
    story.append(PageBreak())  # ensure next page is Body template
    build_toc(story)
    build_executive_summary(story)
    build_feature_matrix(story)
    build_module_specs(story)
    build_advanced_security(story)
    build_clinical_safety(story)
    build_interoperability(story)
    build_qms(story)
    build_bcdr(story)
    build_analytics(story)
    build_patient_engagement(story)
    build_tiers(story)
    build_architecture(story)
    build_roadmap(story)
    build_validation_plan(story)
    build_cost_benefit(story)
    build_additional(story)

    doc.multiBuild(story)
    print(f"✓ PDF generated: {output_path}")
    print(f"  Size: {os.path.getsize(output_path) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
