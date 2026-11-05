"""
QR Code Generation Service
Uses the qrcode library to generate QR codes with custom styles.
Supports all qrfy.com content types: URL, WiFi, vCard, location, social, dynamic, etc.
"""
import qrcode
import qrcode.image.svg
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import (
    RoundedModuleDrawer,
    CircleModuleDrawer,
    SquareModuleDrawer,
)
import base64
import io
import re
from PIL import Image, ImageDraw
from typing import Optional
from ..models.qr import QRCreate, QRType, QRStyle


def build_qr_content(qr: QRCreate) -> str:
    """
    Convert structured content to the correct QR data string for each type.
    Each type has a standard encoding format that QR readers understand.
    """
    t = qr.qr_type
    c = qr.content

    if t == QRType.URL:
        # Ensure URL has protocol
        if not c.startswith(("http://", "https://")):
            c = "https://" + c
        return c

    elif t == QRType.EMAIL:
        # mailto:user@example.com?subject=Hello&body=World
        parts = c.split("|")  # email|subject|body
        email = parts[0].strip()
        subject = parts[1].strip() if len(parts) > 1 else ""
        body = parts[2].strip() if len(parts) > 2 else ""
        params = []
        if subject: params.append(f"subject={subject}")
        if body:    params.append(f"body={body}")
        suffix = "?" + "&".join(params) if params else ""
        return f"mailto:{email}{suffix}"

    elif t == QRType.PHONE:
        # tel:+1234567890
        digits = re.sub(r"[^\d+]", "", c)
        return f"tel:{digits}"

    elif t == QRType.SMS:
        # smsto:+1234567890:Message here
        parts = c.split("|", 1)  # phone|message
        phone = re.sub(r"[^\d+]", "", parts[0])
        msg = parts[1].strip() if len(parts) > 1 else ""
        return f"smsto:{phone}:{msg}"

    elif t == QRType.WIFI:
        # WIFI:T:WPA;S:NetworkName;P:password;;
        # content format: ssid|password|WPA|hidden(true/false)
        parts = c.split("|")
        ssid     = parts[0] if len(parts) > 0 else ""
        password = parts[1] if len(parts) > 1 else ""
        auth     = parts[2].upper() if len(parts) > 2 else "WPA"
        hidden   = "true" if len(parts) > 3 and parts[3].lower() == "true" else "false"
        return f"WIFI:T:{auth};S:{ssid};P:{password};H:{hidden};;"

    elif t == QRType.VCARD:
        # Standard vCard 3.0 format
        # content: name|phone|email|org|url|address
        parts = c.split("|")
        name    = parts[0] if len(parts) > 0 else ""
        phone   = parts[1] if len(parts) > 1 else ""
        email   = parts[2] if len(parts) > 2 else ""
        org     = parts[3] if len(parts) > 3 else ""
        url     = parts[4] if len(parts) > 4 else ""
        address = parts[5] if len(parts) > 5 else ""
        lines = [
            "BEGIN:VCARD", "VERSION:3.0",
            f"FN:{name}", f"N:{name}",
        ]
        if phone:   lines.append(f"TEL:{phone}")
        if email:   lines.append(f"EMAIL:{email}")
        if org:     lines.append(f"ORG:{org}")
        if url:     lines.append(f"URL:{url}")
        if address: lines.append(f"ADR:{address}")
        lines.append("END:VCARD")
        return "\n".join(lines)

    elif t == QRType.LOCATION:
        # geo:lat,lon
        parts = c.split("|", 1)
        lat = parts[0].strip()
        lon = parts[1].strip() if len(parts) > 1 else "0"
        return f"geo:{lat},{lon}"

    elif t == QRType.YOUTUBE:
        # Normalise YouTube URL
        vid_id = c
        if "youtube.com/watch?v=" in c:
            vid_id = c.split("v=")[1].split("&")[0]
        elif "youtu.be/" in c:
            vid_id = c.split("youtu.be/")[1].split("?")[0]
        return f"https://youtube.com/watch?v={vid_id}"

    elif t == QRType.SOCIAL:
        # Content is already a fully-built URL from build_platform_url
        if not c.startswith(("http://", "https://", "mailto:", "tel:", "sms:", "weixin:", "viber:")):
            c = "https://" + c
        return c

    elif t == QRType.SOCIAL_PROFILE:
        # Content is the /p/:slug URL pointing to the hosted profile landing page
        if not c.startswith(("http://", "https://")):
            c = "https://" + c
        return c

    elif t == QRType.DYNAMIC:
        # Content is the /r/:id redirect URL — use as-is
        return c

    else:
        # TEXT, PDF, IMAGE, APP_STORE, MENU — use content directly or as URL
        return c


def _apply_gradient(img_pil: Image.Image, fg_hex: str, fg2_hex: str) -> Image.Image:
    """
    Apply a left-to-right linear gradient over QR foreground pixels.
    Dark pixels in the source image are replaced with the gradient color.
    """
    def hex_to_rgb(h: str) -> tuple:
        h = h.lstrip("#")
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

    c1 = hex_to_rgb(fg_hex)
    c2 = hex_to_rgb(fg2_hex)

    img_rgba = img_pil.convert("RGBA")
    width, height = img_rgba.size
    pixels = img_rgba.load()

    for x in range(width):
        t = x / max(width - 1, 1)
        r = int(c1[0] + (c2[0] - c1[0]) * t)
        g = int(c1[1] + (c2[1] - c1[1]) * t)
        b = int(c1[2] + (c2[2] - c1[2]) * t)
        for y in range(height):
            pr, pg, pb, pa = pixels[x, y]
            # Replace pixels that are close to the foreground color (dark pixels)
            luminance = 0.299 * pr + 0.587 * pg + 0.114 * pb
            if luminance < 128:
                pixels[x, y] = (r, g, b, pa)

    return img_rgba


def generate_qr_image(qr_create: QRCreate) -> tuple[bytes, str]:
    """
    Generate a QR code PNG image.
    Returns (png_bytes, base64_string).
    """
    content = build_qr_content(qr_create)
    style   = qr_create.style

    has_logo = bool(style.logo_b64 or style.logo_url)

    # Error correction level — always use H when embedding a logo
    ec_map = {
        "L": qrcode.constants.ERROR_CORRECT_L,
        "M": qrcode.constants.ERROR_CORRECT_M,
        "Q": qrcode.constants.ERROR_CORRECT_Q,
        "H": qrcode.constants.ERROR_CORRECT_H,
    }
    ec = qrcode.constants.ERROR_CORRECT_H if has_logo else ec_map.get(
        style.error_correct, qrcode.constants.ERROR_CORRECT_H
    )

    # Parse hex colors
    def hex_to_rgb(hex_color: str) -> tuple:
        h = hex_color.lstrip("#")
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

    fg_rgb = hex_to_rgb(style.foreground)
    bg_rgb = hex_to_rgb(style.background)

    # Build QR matrix
    qr = qrcode.QRCode(
        version=None,
        error_correction=ec,
        box_size=style.box_size,
        border=style.border,
    )
    qr.add_data(content)
    qr.make(fit=True)

    # Choose module drawer based on corner_style
    corner = style.corner_style
    if corner == "rounded":
        img = qr.make_image(
            image_factory=StyledPilImage,
            module_drawer=RoundedModuleDrawer(),
            fill_color=fg_rgb,
            back_color=bg_rgb,
        )
    elif corner == "extra_rounded":
        img = qr.make_image(
            image_factory=StyledPilImage,
            module_drawer=CircleModuleDrawer(),
            fill_color=fg_rgb,
            back_color=bg_rgb,
        )
    else:
        # Default square — plain PilImage (no StyledPilImage needed)
        img = qr.make_image(
            fill_color=fg_rgb,
            back_color=bg_rgb,
        )

    # Get PIL Image object
    img_pil: Image.Image = img.get_image() if hasattr(img, "get_image") else img
    if not isinstance(img_pil, Image.Image):
        img_pil = img

    # Ensure RGBA for compositing operations
    img_pil = img_pil.convert("RGBA")

    # Apply gradient overlay if fg_color_2 is set
    if style.fg_color_2:
        try:
            img_pil = _apply_gradient(img_pil, style.foreground, style.fg_color_2)
        except Exception:
            pass  # Fall back to solid color on any error

    # Embed logo
    logo_image: Optional[Image.Image] = None

    if style.logo_b64:
        try:
            logo_bytes = base64.b64decode(style.logo_b64)
            logo_image = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
        except Exception:
            logo_image = None

    elif style.logo_url:
        try:
            import httpx
            resp = httpx.get(style.logo_url, timeout=5.0)
            if resp.status_code == 200:
                logo_image = Image.open(io.BytesIO(resp.content)).convert("RGBA")
        except Exception:
            logo_image = None

    # NOTE: platform_id auto-logo via emoji rendering is unreliable in PIL on most
    # systems (font support varies). Skipped for now — platform_id is reserved for
    # future implementation using a proper emoji/icon font or pre-rendered assets.

    if logo_image is not None:
        try:
            qr_w, qr_h = img_pil.size
            max_logo = int(min(qr_w, qr_h) * style.logo_size)
            logo_image.thumbnail((max_logo, max_logo), Image.LANCZOS)

            pos_x = (qr_w - logo_image.width) // 2
            pos_y = (qr_h - logo_image.height) // 2

            if style.logo_padding:
                # Draw a white filled circle behind the logo
                pad = 10
                circle_r = max(logo_image.width, logo_image.height) // 2 + pad
                circle_layer = Image.new("RGBA", img_pil.size, (0, 0, 0, 0))
                draw = ImageDraw.Draw(circle_layer)
                cx, cy = qr_w // 2, qr_h // 2
                draw.ellipse(
                    [cx - circle_r, cy - circle_r, cx + circle_r, cy + circle_r],
                    fill=(255, 255, 255, 255),
                )
                img_pil = Image.alpha_composite(img_pil, circle_layer)

            img_pil.paste(logo_image, (pos_x, pos_y), logo_image)
        except Exception:
            pass  # Logo embed failure should not break QR generation

    # Export to PNG bytes
    buf = io.BytesIO()
    img_pil = img_pil.convert("RGB")  # PNG with no alpha for maximum compatibility
    img_pil.save(buf, format="PNG")

    png_bytes = buf.getvalue()
    b64 = base64.b64encode(png_bytes).decode("utf-8")
    return png_bytes, b64


def generate_qr_svg(qr_create: QRCreate) -> str:
    """Generate an SVG QR code (scalable, perfect for print)."""
    content = build_qr_content(qr_create)

    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_H,
    )
    qr.add_data(content)
    qr.make(fit=True)

    factory = qrcode.image.svg.SvgPathImage
    img = qr.make_image(image_factory=factory)

    buf = io.BytesIO()
    img.save(buf)
    return buf.getvalue().decode("utf-8")
