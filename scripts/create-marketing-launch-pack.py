from pathlib import Path
import subprocess
import sys
import textwrap

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".tools" / "marketing-video"))

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps
import imageio_ffmpeg

OUT = ROOT / "marketing"
FRAMES = OUT / "frames"
FRAMES.mkdir(parents=True, exist_ok=True)

W, H = 1080, 1920
BG = "#07090B"
SURFACE = "#111419"
BORDER = "#2B3138"
TEXT = "#F7F9F5"
MUTED = "#A1A8B0"
ACCENT = "#B7FF31"
ON_ACCENT = "#0B1004"

FONT_ROOT = ROOT / "node_modules" / "@expo-google-fonts" / "manrope"
FONT_REG = FONT_ROOT / "500Medium" / "Manrope_500Medium.ttf"
FONT_BOLD = FONT_ROOT / "700Bold" / "Manrope_700Bold.ttf"
FONT_XBOLD = FONT_ROOT / "800ExtraBold" / "Manrope_800ExtraBold.ttf"
LOGO = Image.open(ROOT / "assets" / "doit-logo-web.png").convert("RGB")
DESKTOP = Image.open(OUT / "doit-founding-50-desktop.jpg").convert("RGB")
VERTICAL = Image.open(OUT / "doit-founding-50-vertical.jpg").convert("RGB")


def font(path, size):
    return ImageFont.truetype(str(path), size)


def canvas():
    image = Image.new("RGB", (W, H), BG)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((560, -260, 1350, 530), fill=(105, 155, 25, 70))
    gd.ellipse((-380, 1380, 460, 2200), fill=(72, 113, 15, 45))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    image.paste(glow, (0, 0), glow)
    return image


def brand(draw, image, y=82):
    logo = ImageOps.fit(LOGO, (84, 84), method=Image.Resampling.LANCZOS)
    image.paste(logo, (74, y))
    draw.text((184, y + 19), "DOIT AI", font=font(FONT_BOLD, 42), fill=TEXT)


def pill(draw, text, y):
    label_font = font(FONT_BOLD, 28)
    box = draw.textbbox((0, 0), text, font=label_font)
    width = box[2] - box[0] + 62
    draw.rounded_rectangle((74, y, 74 + width, y + 62), radius=31, fill="#17220D", outline="#597E20", width=2)
    draw.ellipse((96, y + 26, 106, y + 36), fill=ACCENT)
    draw.text((122, y + 13), text, font=label_font, fill=ACCENT)


def rounded_image(base, source, box, radius=38, border=3):
    x1, y1, x2, y2 = box
    fitted = ImageOps.fit(source, (x2 - x1, y2 - y1), method=Image.Resampling.LANCZOS)
    mask = Image.new("L", fitted.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, fitted.width, fitted.height), radius=radius, fill=255)
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((x1 + 8, y1 + 22, x2 + 8, y2 + 22), radius=radius, fill=(0, 0, 0, 145))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    base.paste(shadow, (0, 0), shadow)
    ImageDraw.Draw(base).rounded_rectangle((x1 - border, y1 - border, x2 + border, y2 + border), radius=radius + border, fill=BORDER)
    base.paste(fitted, (x1, y1), mask)


def headline(draw, text, y, size=78, width=25, color=TEXT):
    wrapped = "\n".join(textwrap.wrap(text, width=width))
    draw.multiline_text((74, y), wrapped, font=font(FONT_XBOLD, size), fill=color, spacing=10)


def save_slide(number, build):
    image = canvas()
    draw = ImageDraw.Draw(image)
    build(image, draw)
    path = FRAMES / f"slide-{number}.png"
    image.save(path, quality=95)
    return path


slides = []


def slide1(image, draw):
    brand(draw, image)
    pill(draw, "YOUR NEXT MOVE, READY", 285)
    headline(draw, "Big goals feel impossible when the next step isn’t clear.", 410, 92, 22)
    draw.text((74, 1045), "DOIT turns any goal into a measurable plan—and", font=font(FONT_REG, 38), fill=MUTED)
    draw.text((74, 1100), "puts one useful action in front of you today.", font=font(FONT_REG, 38), fill=MUTED)
    draw.rounded_rectangle((74, 1305, 635, 1425), radius=34, fill=ACCENT)
    draw.text((120, 1334), "Stop overthinking. Just DOIT.", font=font(FONT_BOLD, 35), fill=ON_ACCENT)
    draw.text((74, 1745), "doit-ai.pages.dev", font=font(FONT_BOLD, 38), fill=TEXT)


slides.append(save_slide(1, slide1))


def slide2(image, draw):
    brand(draw, image)
    pill(draw, "STEP 1", 215)
    headline(draw, "Say the goal exactly how it exists in your head.", 310, 72, 25)
    crop = VERTICAL.crop((0, 105, VERTICAL.width, VERTICAL.height))
    rounded_image(image, crop, (105, 790, 975, 1700), 42)
    draw.text((105, 1760), "No complicated setup. Start naturally.", font=font(FONT_BOLD, 33), fill=ACCENT)


slides.append(save_slide(2, slide2))


def slide3(image, draw):
    brand(draw, image)
    pill(draw, "STEP 2", 215)
    headline(draw, "Get a clear action—not another overwhelming list.", 310, 72, 24)
    preview = DESKTOP.crop((785, 165, 1375, 765))
    rounded_image(image, preview, (90, 760, 990, 1675), 42)
    draw.text((90, 1740), "One move. Then momentum.", font=font(FONT_BOLD, 42), fill=ACCENT)


slides.append(save_slide(3, slide3))


def slide4(image, draw):
    brand(draw, image)
    pill(draw, "EARLY ACCESS", 250)
    headline(draw, "Join the DOIT Founding 50.", 355, 90, 21)
    draw.text((74, 720), "Help shape what DOIT becomes and keep your", font=font(FONT_REG, 38), fill=MUTED)
    draw.text((74, 775), "permanent numbered Founding Member badge.", font=font(FONT_REG, 38), fill=MUTED)
    draw.rounded_rectangle((74, 980, 1006, 1305), radius=42, fill=SURFACE, outline="#587C22", width=3)
    draw.text((124, 1040), "48", font=font(FONT_XBOLD, 170), fill=ACCENT)
    draw.text((385, 1087), "founding spots left", font=font(FONT_BOLD, 47), fill=TEXT)
    draw.text((124, 1250), "Live counter · first eligible accounts only", font=font(FONT_REG, 28), fill=MUTED)
    draw.rounded_rectangle((74, 1470, 1006, 1605), radius=38, fill=ACCENT)
    draw.text((230, 1504), "Build your first plan free", font=font(FONT_BOLD, 43), fill=ON_ACCENT)
    draw.text((74, 1745), "doit-ai.pages.dev", font=font(FONT_BOLD, 38), fill=TEXT)


slides.append(save_slide(4, slide4))


ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
inputs = []
for path in slides:
    inputs += ["-loop", "1", "-t", "2.8", "-i", str(path)]

filters = (
    "[0:v]fps=30,format=yuv420p[v0];"
    "[1:v]fps=30,format=yuv420p[v1];"
    "[2:v]fps=30,format=yuv420p[v2];"
    "[3:v]fps=30,format=yuv420p[v3];"
    "[v0][v1]xfade=transition=fade:duration=0.35:offset=2.45[x1];"
    "[x1][v2]xfade=transition=fade:duration=0.35:offset=4.90[x2];"
    "[x2][v3]xfade=transition=fade:duration=0.35:offset=7.35[outv]"
)

output = OUT / "doit-founding-50-promo.mp4"
command = [ffmpeg, "-y", *inputs, "-filter_complex", filters, "-map", "[outv]", "-t", "10.15", "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(output)]
subprocess.run(command, check=True)
print(output)

