from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "marketing" / "native-tiktok-assets"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1080, 1920
WHITE = (255, 255, 255, 255)
YELLOW = (255, 225, 92, 255)


def font(size: int, bold: bool = False):
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)


def wrap(draw, text, text_font, max_width):
    words = text.split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        width = draw.textbbox((0, 0), candidate, font=text_font, stroke_width=4)[2]
        if current and width > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def make_caption(filename: str, message: str):
    image = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    label_font = font(27, True)
    label = "building my app in public"
    label_width = draw.textbbox((0, 0), label, font=label_font)[2]
    draw.rounded_rectangle(
        ((W - label_width) // 2 - 23, 62, (W + label_width) // 2 + 23, 112),
        radius=22,
        fill=(0, 0, 0, 170),
    )
    draw.text(((W - label_width) // 2, 70), label, font=label_font, fill=YELLOW)

    message_font = font(61, True)
    lines = wrap(draw, message, message_font, 960)
    y = 150
    for line in lines:
        box = draw.textbbox((0, 0), line, font=message_font, stroke_width=5)
        x = (W - (box[2] - box[0])) // 2
        draw.text(
            (x, y),
            line,
            font=message_font,
            fill=WHITE,
            stroke_width=5,
            stroke_fill=(0, 0, 0, 235),
        )
        y += 75

    image.save(OUT / filename)


def make_reaction_caption():
    image = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    small = font(28, True)
    headline = font(68, True)

    pill = "i tried this with one sentence"
    pill_width = draw.textbbox((0, 0), pill, font=small)[2]
    draw.rounded_rectangle(
        ((W - pill_width) // 2 - 24, 92, (W + pill_width) // 2 + 24, 150),
        radius=28,
        fill=(10, 10, 12, 205),
    )
    draw.text(((W - pill_width) // 2, 102), pill, font=small, fill=YELLOW)

    lines = ["WAIT... THIS AI", "MADE MY WHOLE PLAN?"]
    y = 182
    for line in lines:
        box = draw.textbbox((0, 0), line, font=headline, stroke_width=6)
        x = (W - (box[2] - box[0])) // 2
        draw.text(
            (x, y), line, font=headline, fill=WHITE,
            stroke_width=6, stroke_fill=(0, 0, 0, 235),
        )
        y += 82
    image.save(OUT / "reaction-caption.png")


def make_url_card():
    image = Image.new("RGBA", (W, H), (5, 5, 7, 255))
    draw = ImageDraw.Draw(image)
    logo_path = ROOT / "public" / "doit-logo.png"
    if logo_path.exists():
        logo = Image.open(logo_path).convert("RGBA")
        logo.thumbnail((190, 190), Image.Resampling.LANCZOS)
        image.alpha_composite(logo, ((W - logo.width) // 2, 370))

    eyebrow = font(29, True)
    title = font(74, True)
    url_font = font(47, True)
    body = font(32)

    eyebrow_text = "YOUR NEXT MOVE IS WAITING"
    eyebrow_width = draw.textbbox((0, 0), eyebrow_text, font=eyebrow)[2]
    draw.text(((W - eyebrow_width) // 2, 600), eyebrow_text, font=eyebrow, fill=(164, 122, 255, 255))

    for y, line in [(675, "Turn the goal in your head"), (760, "into a plan you can do.")]:
        width = draw.textbbox((0, 0), line, font=title)[2]
        draw.text(((W - width) // 2, y), line, font=title, fill=WHITE)

    draw.rounded_rectangle((112, 950, 968, 1060), radius=42, fill=(164, 122, 255, 255))
    url = "doit-ai.pages.dev"
    url_width = draw.textbbox((0, 0), url, font=url_font)[2]
    draw.text(((W - url_width) // 2, 974), url, font=url_font, fill=(8, 7, 12, 255))

    footer = "try it free in your browser"
    footer_width = draw.textbbox((0, 0), footer, font=body)[2]
    draw.text(((W - footer_width) // 2, 1092), footer, font=body, fill=(194, 194, 204, 255))
    image.save(OUT / "url-card.png")


if __name__ == "__main__":
    make_caption("caption-1.png", "POV: your goal finally tells you what to do today")
    make_caption("caption-2.png", "i typed: lose 10kg safely")
    make_caption("caption-3.png", "DOIT built the whole plan")
    make_caption("caption-4.png", "safe milestones. no crash-diet advice.")
    make_caption("caption-5.png", "then it gave me today's first actions")
    make_caption("caption-6.png", "what goal should i test next?")
    make_reaction_caption()
    make_caption("reaction-demo-1.png", "i only typed: lose 10kg safely")
    make_caption("reaction-demo-2.png", "it built milestones that actually make sense")
    make_caption("reaction-demo-3.png", "then gave me the exact first moves")
    make_url_card()
    print(OUT)
