from pathlib import Path
import math
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "marketing" / "tiktok-ready-assets"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1080, 1920
PURPLE = (157, 118, 255)
VIOLET = (105, 70, 255)
WHITE = (248, 248, 252)
MUTED = (165, 169, 184)
SURFACE = (17, 19, 25)
BORDER = (55, 49, 78)


def font(size: int, bold: bool = False):
    path = Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf")
    return ImageFont.truetype(str(path), size)


def gradient_background():
    top = np.array([8, 8, 13], dtype=np.float32)
    bottom = np.array([12, 8, 24], dtype=np.float32)
    y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    arr = np.tile((top * (1 - y) + bottom * y), (1, W, 1))
    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.exp(-(((xx - 780) / 530) ** 2 + ((yy - 320) / 440) ** 2))[:, :, None]
    arr += glow * np.array([32, 12, 70], dtype=np.float32)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def add_logo(canvas: Image.Image, x: int, y: int, size: int):
    logo = Image.open(ROOT / "assets" / "doit-logo-web.png").convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius=int(size * .24), fill=255)
    canvas.paste(logo, (x, y), mask)


def centre_text(draw: ImageDraw.ImageDraw, text: str, y: int, text_font, fill, max_width=980):
    box = draw.textbbox((0, 0), text, font=text_font)
    draw.text(((W - (box[2] - box[0])) / 2, y), text, font=text_font, fill=fill)


def make_base():
    image = gradient_background()
    draw = ImageDraw.Draw(image)
    add_logo(image, 64, 64, 82)
    draw.text((166, 76), "DOIT AI", font=font(34, True), fill=WHITE)
    draw.text((166, 116), "YOUR NEXT MOVE, READY", font=font(17, True), fill=PURPLE)

    pill = (64, 215, 352, 267)
    draw.rounded_rectangle(pill, radius=26, fill=(43, 30, 73), outline=(88, 62, 139), width=2)
    draw.ellipse((86, 234, 96, 244), fill=PURPLE)
    draw.text((111, 226), "REAL DOIT DEMO", font=font(18, True), fill=(190, 166, 255))

    draw.text((64, 307), "A safer goal.", font=font(66, True), fill=WHITE)
    draw.text((64, 381), "A clear plan in seconds.", font=font(66, True), fill=WHITE)
    draw.text((66, 476), "Watch DOIT turn “Lose 10 kg safely” into practical first steps.", font=font(25), fill=MUTED)

    # Video frame and subtle glow.
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle((38, 525, 1042, 1095), radius=36, fill=(130, 82, 255, 105))
    glow = glow.filter(ImageFilter.GaussianBlur(35))
    image.alpha_composite(glow)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((44, 531, 1036, 1089), radius=28, fill=(13, 14, 19), outline=BORDER, width=3)

    draw.rounded_rectangle((64, 1490, 1016, 1604), radius=28, fill=PURPLE)
    centre_text(draw, "WHAT GOAL NEXT?  ↓", 1518, font(31, True), (18, 10, 32))
    centre_text(draw, "Join the Founding 50  •  link in bio", 1648, font(23, True), (204, 191, 239))
    draw.text((64, 1770), "doit-ai.pages.dev", font=font(22, True), fill=(127, 119, 157))
    image.save(OUT / "base.png")


def make_stage(name: str, label: str, detail: str):
    image = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    box = (64, 1110, 1016, 1206)
    draw.rounded_rectangle(box, radius=26, fill=(20, 19, 29, 248), outline=(81, 65, 115, 255), width=2)
    draw.rounded_rectangle((82, 1127, 272, 1189), radius=20, fill=(47, 31, 78, 255))
    draw.text((105, 1143), label, font=font(20, True), fill=(194, 170, 255))
    draw.text((299, 1137), detail, font=font(25, True), fill=WHITE)
    image.save(OUT / name)


def make_outro():
    image = gradient_background()
    draw = ImageDraw.Draw(image)
    add_logo(image, 390, 240, 300)
    centre_text(draw, "What goal should", 650, font(67, True), WHITE)
    centre_text(draw, "I test next?", 730, font(67, True), WHITE)
    centre_text(draw, "Comment it below and I’ll run", 880, font(28), MUTED)
    centre_text(draw, "the best one through DOIT.", 925, font(28), MUTED)
    draw.rounded_rectangle((96, 1085, 984, 1215), radius=34, fill=PURPLE)
    centre_text(draw, "COMMENT THE NEXT GOAL  ↓", 1122, font(34, True), (18, 10, 32))
    centre_text(draw, "Join the Founding 50", 1325, font(30, True), (201, 178, 255))
    centre_text(draw, "doit-ai.pages.dev", 1380, font(25), MUTED)
    image.save(OUT / "outro.png")


def make_music(duration=26.6, sample_rate=48000):
    count = int(duration * sample_rate)
    t = np.arange(count, dtype=np.float64) / sample_rate
    audio = np.zeros(count, dtype=np.float64)
    # Soft synth pad in D minor.
    for frequency, amplitude in [(146.83, .032), (174.61, .022), (220.00, .021), (261.63, .014)]:
        audio += amplitude * np.sin(2 * math.pi * frequency * t + .2 * np.sin(2 * math.pi * .12 * t))
    # A clean, quiet pulse and a small high pluck for movement.
    for beat in np.arange(0, duration, .5):
        start = int(beat * sample_rate)
        length = min(int(.22 * sample_rate), count - start)
        if length <= 0:
            continue
        local_t = np.arange(length) / sample_rate
        audio[start:start + length] += .13 * np.sin(2 * math.pi * 73.42 * local_t) * np.exp(-18 * local_t)
    notes = [293.66, 440.0, 349.23, 523.25]
    for index, beat in enumerate(np.arange(.25, duration, .5)):
        start = int(beat * sample_rate)
        length = min(int(.18 * sample_rate), count - start)
        local_t = np.arange(length) / sample_rate
        audio[start:start + length] += .045 * np.sin(2 * math.pi * notes[index % len(notes)] * local_t) * np.exp(-15 * local_t)
    fade = int(.8 * sample_rate)
    audio[:fade] *= np.linspace(0, 1, fade)
    audio[-fade:] *= np.linspace(1, 0, fade)
    audio = np.tanh(audio * 1.5) * .72
    stereo = np.column_stack((audio, np.roll(audio, 19)))
    pcm = np.int16(np.clip(stereo, -1, 1) * 32767)
    with wave.open(str(OUT / "music.wav"), "wb") as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(sample_rate)
        stream.writeframes(pcm.tobytes())


if __name__ == "__main__":
    make_base()
    make_stage("stage-1.png", "STEP 1", "State the outcome naturally")
    make_stage("stage-2.png", "STEP 2", "DOIT builds safer milestones")
    make_stage("stage-3.png", "STEP 3", "Start with today’s actions")
    make_outro()
    make_music()
    print(OUT)
