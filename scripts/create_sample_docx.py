import zipfile
import os

docx_path = os.path.join(os.getcwd(), 'knowledge', 'security_compliance.docx')

content_types_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''

rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

document_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Security and Data Compliance Guide</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>SOC 2 Type II &amp; ISO 27001 Certifications</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Apex Systems undergoes annual SOC 2 Type II audits conducted by independent third-party assessors. All sensitive customer records and proprietary knowledge documents are encrypted at rest using AES-256 and in transit via TLS 1.3 encryption.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>Data Residency &amp; Regional Sovereignty</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Enterprise tier customers can select dedicated data residency zones including US-East (North Virginia), EU-Central (Frankfurt), and AP-South (Mumbai). Customer files never leave the designated geographical jurisdiction without explicit customer consent.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>Incident Response Time SLA</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>In the event of an anomalous security alert or incident, our Tier-1 Security Operations Center delivers an initial investigative briefing within 15 minutes, followed by an hourly status report until resolution.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>'''

with zipfile.ZipFile(docx_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.writestr('[Content_Types].xml', content_types_xml)
    zf.writestr('_rels/.rels', rels_xml)
    zf.writestr('word/document.xml', document_xml)

print(f"Created docx at: {docx_path}")
