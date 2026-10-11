import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            super().showPage()
        super().save()


def build_pdf(output_path):
    # A4 dimensions: 595.27 x 841.89 points
    # Printable area: 595.27 - 2*34 = 527.27 pt width
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=34,
        rightMargin=34,
        topMargin=28,
        bottomMargin=26
    )

    PRIMARY_COLOR = colors.HexColor("#111827")     # Dark slate / almost black
    TEXT_COLOR = colors.HexColor("#1f2937")        # Charcoal body text
    MUTED_COLOR = colors.HexColor("#4b5563")       # Medium grey for secondary text
    LINK_COLOR = colors.HexColor("#1d4ed8")        # Professional royal blue for hyperlinks
    LINE_COLOR = colors.HexColor("#111827")        # Section divider line
    TECH_COLOR = colors.HexColor("#1d4ed8")        # Blue tech stack highlighting

    # Typography styles
    name_style = ParagraphStyle(
        'ResumeName',
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=22,
        alignment=1, # Center
        textColor=PRIMARY_COLOR,
        spaceAfter=4
    )

    contact_style = ParagraphStyle(
        'ResumeContact',
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        alignment=1, # Center
        textColor=MUTED_COLOR,
        spaceAfter=7
    )

    section_heading_style = ParagraphStyle(
        'SectionHeading',
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=11,
        textColor=PRIMARY_COLOR,
        spaceBefore=0,
        spaceAfter=2
    )

    body_style = ParagraphStyle(
        'BodyTextCustom',
        fontName='Helvetica',
        fontSize=8.2,
        leading=10.5,
        textColor=TEXT_COLOR,
        alignment=4 # Justify
    )

    bullet_style = ParagraphStyle(
        'BulletCustom',
        fontName='Helvetica',
        fontSize=8.1,
        leading=10.2,
        textColor=TEXT_COLOR,
        leftIndent=11,
        firstLineIndent=-11,
        spaceAfter=1.8
    )

    role_left = ParagraphStyle(
        'RoleLeft',
        fontName='Helvetica-Bold',
        fontSize=8.6,
        leading=10.5,
        textColor=PRIMARY_COLOR
    )

    role_right = ParagraphStyle(
        'RoleRight',
        fontName='Helvetica',
        fontSize=8.2,
        leading=10.5,
        alignment=2, # Right
        textColor=MUTED_COLOR
    )

    proj_left = ParagraphStyle(
        'ProjLeft',
        fontName='Helvetica',
        fontSize=8.4,
        leading=10.5,
        textColor=PRIMARY_COLOR
    )

    proj_right = ParagraphStyle(
        'ProjRight',
        fontName='Helvetica-Bold',
        fontSize=8.2,
        leading=10.5,
        alignment=2, # Right
        textColor=LINK_COLOR
    )

    edu_title = ParagraphStyle(
        'EduTitle',
        fontName='Helvetica-Bold',
        fontSize=8.6,
        leading=10.5,
        textColor=PRIMARY_COLOR
    )

    edu_sub = ParagraphStyle(
        'EduSub',
        fontName='Helvetica-Oblique',
        fontSize=8.2,
        leading=10.2,
        textColor=TEXT_COLOR
    )

    edu_right = ParagraphStyle(
        'EduRight',
        fontName='Helvetica',
        fontSize=8.2,
        leading=10.5,
        alignment=2,
        textColor=MUTED_COLOR
    )

    def section_header(title):
        elements = [
            Paragraph(f"<b>{title}</b>", section_heading_style),
            HRFlowable(width="100%", thickness=0.8, color=LINE_COLOR, spaceBefore=1, spaceAfter=4)
        ]
        return elements

    story = []

    # 1. HEADER
    story.append(Paragraph("<b>ANUSHKA VERMA</b>", name_style))
    contact_line = (
        'Lucknow, India &nbsp;|&nbsp; +91 8090057950 &nbsp;|&nbsp; '
        '<a href="mailto:10anushka2023@gmail.com"><font color="#1d4ed8">10anushka2023@gmail.com</font></a> &nbsp;|&nbsp; '
        '<a href="https://www.linkedin.com/in/anushka-verma-2a9970331"><font color="#1d4ed8">linkedin.com/in/anushka-verma</font></a> &nbsp;|&nbsp; '
        '<a href="https://github.com/Anushkaverma19"><font color="#1d4ed8">github.com/Anushkaverma19</font></a> &nbsp;|&nbsp; '
        '<a href="https://10anushka2023.wixsite.com/my-site-2"><font color="#1d4ed8">Portfolio</font></a>'
    )
    story.append(Paragraph(contact_line, contact_style))
    story.append(Spacer(1, 1))

    # 2. PROFESSIONAL SUMMARY
    story.extend(section_header("PROFESSIONAL SUMMARY"))
    summary_text = (
        "B.Tech Computer Science undergraduate specializing in full-stack web development and applied AI. "
        "Experienced in architecting responsive web applications, secure RESTful microservices, and database systems with "
        "PostgreSQL and MongoDB. Proficient in integrating Google Gemini AI and machine learning workflows into production-grade "
        "web platforms. Passionate about engineering high-concurrency, scalable cloud software solutions."
    )
    story.append(Paragraph(summary_text, body_style))
    story.append(Spacer(1, 4))

    # 3. TECHNICAL SKILLS
    story.extend(section_header("TECHNICAL SKILLS"))
    skills_data = [
        "<b>Languages:</b> Java, JavaScript (ES6+), TypeScript, Python, SQL, HTML5, CSS3",
        "<b>Web Technologies:</b> React.js, Next.js (App Router), Node.js, Express.js, Tailwind CSS, RESTful APIs, JWT, OAuth",
        "<b>Databases & Cloud:</b> Supabase (PostgreSQL, RLS), MongoDB, MySQL, Mongoose, Vercel, Render",
        "<b>Developer Tools & Concepts:</b> Git, GitHub, Postman, MVC Architecture, RBAC, Row Level Security, Concurrency Control"
    ]
    for s in skills_data:
        story.append(Paragraph(s, ParagraphStyle('SkillLine', fontName='Helvetica', fontSize=8.2, leading=10.4, textColor=TEXT_COLOR)))
    story.append(Spacer(1, 4))

    # 4. WORK EXPERIENCE
    story.extend(section_header("WORK EXPERIENCE"))
    exp_header = Table([
        [
            Paragraph("<b>Codveda Technologies</b> | Full Stack Development Intern", role_left),
            Paragraph("July 2026 – August 2026 | Remote", role_right)
        ]
    ], colWidths=[355, 172])
    exp_header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(exp_header)
    exp_bullets = [
        "&bull;&nbsp;&nbsp;Developed a full-stack GitHub Analyzer web platform to fetch, analyze, and visualize repository metrics and developer activity.",
        "&bull;&nbsp;&nbsp;Integrated REST APIs and GitHub REST API to retrieve repository commits, pull requests, and code frequency for analytical processing.",
        "&bull;&nbsp;&nbsp;Engineered a high-performance frontend interface connected to backend analytical endpoints, ensuring low latency data rendering.",
        "&bull;&nbsp;&nbsp;Conducted comprehensive testing, bug resolution, and API optimizations to maximize system reliability and user experience."
    ]
    for b in exp_bullets:
        story.append(Paragraph(b, bullet_style))
    story.append(Spacer(1, 4))

    # 5. PROJECTS
    story.extend(section_header("PROJECTS"))

    def project_item(title, tech, demo_url, github_url, bullets):
        links_parts = []
        if demo_url:
            links_parts.append(f'<a href="{demo_url}"><font color="#1d4ed8">[Live Demo]</font></a>')
        if github_url:
            links_parts.append(f'<a href="{github_url}"><font color="#1d4ed8">[GitHub]</font></a>')
        links_html = "&nbsp;&nbsp;".join(links_parts)

        left_html = f"<b>{title}</b> &nbsp;|&nbsp; <font color='#1d4ed8'><b>{tech}</b></font>"
        tbl = Table([
            [Paragraph(left_html, proj_left), Paragraph(links_html, proj_right)]
        ], colWidths=[385, 142])
        tbl.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 1.5),
        ]))
        res = [tbl]
        for b in bullets:
            res.append(Paragraph(f"&bull;&nbsp;&nbsp;{b}", bullet_style))
        res.append(Spacer(1, 2.5))
        return res

    # Project 1: MEHRAE
    story.extend(project_item(
        "MEHRAÉ – Fashion Boutique E-Commerce",
        "Next.js, TypeScript, Supabase, Google Gemini API, Tailwind CSS",
        "https://mehrae-womens-boutique-phi.vercel.app/",
        "https://github.com/Anushkaverma19/Women-s-botique",
        [
            "Engineered full-stack e-commerce architecture with atomic PostgreSQL row-locking checkout preventing inventory overselling.",
            "Implemented Supabase Auth with Role-Based Access Control and Row Level Security (RLS) policies enforcing strict tenant data privacy.",
            "Integrated Google Gemini API for an intelligent shopping assistant recommending verified in-stock catalog products in real time."
        ]
    ))

    # Project 2: Dine AI Flow
    story.extend(project_item(
        "Dine AI Flow – Smart Restaurant Management",
        "Next.js, React.js, Node.js, Express.js, MongoDB, JWT",
        "https://dine-flow-ai-eight.vercel.app/",
        "https://github.com/Anushkaverma19/DineFlow-AI",
        [
            "Built an AI-driven restaurant management system handling digital reservation flows, live order tracking, and admin dashboards.",
            "Architected secure JWT authentication and role-based permissions (Admin/Staff/Customer) across modular RESTful endpoints.",
            "Implemented AI-assisted menu recommendations and operational reporting with responsive Tailwind CSS interface deployed on Vercel."
        ]
    ))

    # Project 3: Nearest School Finder
    story.extend(project_item(
        "Nearest School Finder – Spatial Web App",
        "Next.js, TypeScript, MongoDB, Geolocation API, Tailwind CSS",
        "https://near-school-finder.vercel.app/",
        "https://github.com/Anushkaverma19/near-school-finder",
        [
            "Engineered a location-based discovery platform identifying nearby schools utilizing browser Geolocation APIs and spatial queries.",
            "Implemented dynamic distance-filtering algorithms and optimized MongoDB endpoints for high-throughput spatial search.",
            "Designed a clean mobile-responsive user interface and configured automated continuous deployment pipelines on Vercel."
        ]
    ))

    # Project 4: Lead Management Platform
    story.extend(project_item(
        "Lead Management Platform – CRM System",
        "Next.js, React.js, Node.js, RESTful APIs, Tailwind CSS",
        "https://fullstack-lead-management-platform.vercel.app/",
        None,
        [
            "Architected an end-to-end CRM lead tracking platform with interactive sales stage pipelines and status management workflows.",
            "Implemented lead filtering, real-time status transitions, and analytical metrics dashboards to accelerate sales conversion."
        ]
    ))
    story.append(Spacer(1, 1))

    # 6. EDUCATION
    story.extend(section_header("EDUCATION"))
    edu_tbl1 = Table([
        [
            Paragraph("<b>Dr. A.P.J. Abdul Kalam Technical University</b>", edu_title),
            Paragraph("Lucknow, India", edu_right)
        ],
        [
            Paragraph("Bachelor of Technology in Computer Science and Engineering", edu_sub),
            Paragraph("2023 – 2027 (Expected May 2027)", edu_right)
        ]
    ], colWidths=[370, 157])
    edu_tbl1.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
    ]))
    story.append(edu_tbl1)
    story.append(Paragraph(
        "<b>Key Coursework:</b> Data Structures & Algorithms, Object-Oriented Programming, Database Management Systems, Operating Systems, Web Development",
        ParagraphStyle('Coursework', fontName='Helvetica', fontSize=8.0, leading=10.0, textColor=MUTED_COLOR, spaceAfter=2.5)
    ))

    edu_tbl2 = Table([
        [
            Paragraph("<b>Pioneer Montessori Inter College</b>", edu_title),
            Paragraph("Lucknow, India", edu_right)
        ],
        [
            Paragraph("Class XII (Senior Secondary) &nbsp;|&nbsp; Class X (High School)", edu_sub),
            Paragraph("2021 – 2023", edu_right)
        ]
    ], colWidths=[370, 157])
    edu_tbl2.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
    ]))
    story.append(edu_tbl2)
    story.append(Spacer(1, 3))

    # 7. CERTIFICATIONS
    story.extend(section_header("CERTIFICATIONS"))
    certs = [
        "&bull;&nbsp;&nbsp;<b>Programming in Java</b> – NPTEL, IIT Kharagpur (Elite + Gold) &nbsp;&nbsp;|&nbsp;&nbsp; <b>Frontend Developer (React)</b> – HackerRank",
        "&bull;&nbsp;&nbsp;<b>Full Stack Web Development</b> – Apna College &nbsp;&nbsp;|&nbsp;&nbsp; <b>Data Structures & Algorithms</b> – Apna College"
    ]
    for c in certs:
        story.append(Paragraph(c, ParagraphStyle('CertItem', fontName='Helvetica', fontSize=8.1, leading=10.2, textColor=TEXT_COLOR, spaceAfter=1.5)))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"SUCCESS: Generated PDF at {output_path}")

if __name__ == "__main__":
    out_file = r"c:\Users\Anushka Verma\OneDrive\Desktop\vermas_compress.pdf"
    if len(sys.argv) > 1:
        out_file = sys.argv[1]
    build_pdf(out_file)
