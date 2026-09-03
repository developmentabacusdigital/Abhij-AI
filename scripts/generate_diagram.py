import os
from PIL import Image, ImageDraw, ImageFont

img_dir = os.path.join(os.getcwd(), 'knowledge', 'images')
os.makedirs(img_dir, exist_ok=True)
img_path = os.path.join(img_dir, 'system_architecture.png')

width, height = 960, 480
img = Image.new('RGB', (width, height), color=(15, 15, 15))
draw = ImageDraw.Draw(img)

# Draw subtle grid background
for x in range(0, width, 40):
    draw.line([(x, 0), (x, height)], fill=(28, 28, 28), width=1)
for y in range(0, height, 40):
    draw.line([(0, y), (width, y)], fill=(28, 28, 28), width=1)

# Draw Outer Border
draw.rounded_rectangle([(15, 15), (width - 15, height - 15)], radius=12, outline=(60, 60, 60), width=2)

# Title
draw.text((40, 35), "ABHIJ-AI KNOWLEDGE RETRIEVAL & GROUNDING ARCHITECTURE", fill=(255, 255, 255))
draw.line([(40, 60), (620, 60)], fill=(120, 120, 120), width=1)

# Function to draw node
def draw_node(box, title, subtitle, fill_bg=(25, 25, 25), outline=(100, 100, 100)):
    draw.rounded_rectangle(box, radius=8, fill=fill_bg, outline=outline, width=2)
    x1, y1, x2, y2 = box
    draw.text((x1 + 16, y1 + 18), title, fill=(255, 255, 255))
    draw.text((x1 + 16, y1 + 42), subtitle, fill=(160, 160, 160))

# Nodes
draw_node((40, 120, 260, 200), "1. User Query", "Desktop / Mobile Phone")
draw_node((340, 120, 600, 200), "2. Abhij-AI RAG Server", "Next.js App Router (Node.js)")
draw_node((680, 120, 910, 200), "3. OpenRouter Gemma", "Gemma 3 12B IT (Temp: 0.2)")

draw_node((40, 280, 260, 380), "Knowledge Base", ".md, .docx, .doc, .txt")
draw_node((340, 280, 600, 380), "Document Parser & Chunker", "mammoth & word-extractor")
draw_node((680, 280, 910, 380), "4. Grounded Output", "Streamed Answer + Citations")

# Connecting Arrows
def draw_arrow(start, end, label=""):
    draw.line([start, end], fill=(220, 220, 220), width=2)
    ex, ey = end
    if start[0] < end[0]: # horizontal right
        draw.polygon([(ex, ey), (ex - 8, ey - 5), (ex - 8, ey + 5)], fill=(220, 220, 220))
    elif start[1] < end[1]: # vertical down
        draw.polygon([(ex, ey), (ex - 5, ey - 8), (ex + 5, ey - 8)], fill=(220, 220, 220))
    if label:
        lx = (start[0] + end[0]) // 2 - 20
        ly = (start[1] + end[1]) // 2 - 14
        draw.text((lx, ly), label, fill=(180, 180, 180))

draw_arrow((260, 160), (340, 160), "POST")
draw_arrow((600, 160), (680, 160), "Strict Context")
draw_arrow((260, 330), (340, 330), "Extract")
draw_arrow((470, 280), (470, 200), "Ranked Sections")
draw_arrow((795, 200), (795, 280), "SSE Stream")

img.save(img_path)
print(f"Generated diagram at {img_path}")
