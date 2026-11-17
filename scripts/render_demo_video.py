#!/usr/bin/env python3
"""Render a short, silent explainer of the local mock demo.

This is a slide-based summary of an observed local Ganache run, not a screen
recording and not evidence of a live Aevum deployment or payment. Requires
Pillow and ffmpeg, which are optional system tools and not npm dependencies.
"""
from pathlib import Path
import subprocess
import sys
import tempfile
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 720
BG = (9, 15, 30)
PANEL = (18, 28, 48)
WHITE = (237, 243, 250)
MUTED = (163, 178, 199)
TEAL = (68, 215, 190)
BLUE = (110, 165, 255)
AMBER = (255, 194, 92)
RED = (255, 130, 125)

FONT_DIR = Path('/usr/share/fonts/truetype/dejavu')

def font(name, size):
    path = FONT_DIR / name
    try:
        return ImageFont.truetype(str(path), size)
    except OSError:
        return ImageFont.load_default()

REG = lambda size: font('DejaVuSans.ttf', size)
BOLD = lambda size: font('DejaVuSans-Bold.ttf', size)
MONO = lambda size: font('DejaVuSansMono.ttf', size)


def wrapped(draw, text, xy, width, fnt, fill, gap=10):
    x, y = xy
    words = text.split()
    line = ''
    for word in words:
        trial = f'{line} {word}'.strip()
        if draw.textbbox((0, 0), trial, font=fnt)[2] <= width:
            line = trial
        else:
            draw.text((x, y), line, font=fnt, fill=fill)
            y += fnt.size + gap
            line = word
    if line:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + gap
    return y


def base(scene, title, subtitle):
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((66, 58, 1214, 642), radius=24, fill=PANEL, outline=(41, 59, 88), width=2)
    d.text((104, 88), 'AEVUM CHECKOUT  /  LOCAL PROTOTYPE', font=BOLD(19), fill=TEAL)
    d.text((104, 139), title, font=BOLD(43), fill=WHITE)
    wrapped(d, subtitle, (106, 202), 1040, REG(23), MUTED, 8)
    d.line((104, 584, 1176, 584), fill=(47, 64, 91), width=2)
    d.text((104, 602), 'LOCAL MOCK DEMO — NOT AVEUM · NO PUBLIC-CHAIN TRANSACTION', font=BOLD(15), fill=AMBER)
    d.text((1144, 602), f'{scene}/6', font=MONO(15), fill=MUTED)
    return im, d


def save_frame(path, draw_fn, scene):
    im = draw_fn()
    im.save(path, format='PNG', optimize=True)


def scene1():
    im, d = base(1, 'Invoice checkout, end to end', 'A small ERC-20 payment prototype built during the QDay Aevum Builder Challenge window.')
    d.rounded_rectangle((106, 300, 1173, 514), radius=18, fill=(12, 23, 42), outline=(55, 82, 119), width=2)
    d.text((145, 337), 'MERCHANT', font=BOLD(17), fill=BLUE)
    d.text((145, 383), 'creates a fixed-price invoice', font=REG(25), fill=WHITE)
    d.text((485, 385), '→', font=BOLD(34), fill=TEAL)
    d.text((560, 337), 'PAYER', font=BOLD(17), fill=BLUE)
    d.text((560, 383), 'approves exact amount', font=REG(25), fill=WHITE)
    d.text((893, 385), '→', font=BOLD(34), fill=TEAL)
    d.text((965, 337), 'SETTLE', font=BOLD(17), fill=BLUE)
    d.text((965, 383), 'direct to merchant', font=REG(21), fill=WHITE)
    return im


def scene2():
    im, d = base(2, 'What the contract does', 'One invoice is paid once; the contract records the payer and sends tokens directly to the merchant.')
    cards = [
        ('01  INVOICE', 'Merchant sets an exact amount. A unique invoice ID is emitted.'),
        ('02  APPROVAL', 'Payer grants the checkout allowance for the invoice amount.'),
        ('03  PAYMENT', 'Checkout calls transferFrom(payer, merchant, amount) and emits InvoicePaid.'),
    ]
    y = 300
    for head, body in cards:
        d.rounded_rectangle((110, y, 1172, y+76), radius=14, fill=(12, 23, 42), outline=(41, 59, 88), width=2)
        d.text((136, y+21), head, font=BOLD(17), fill=TEAL)
        d.text((320, y+20), body, font=REG(19), fill=WHITE)
        y += 92
    return im


def scene3():
    im, d = base(3, 'Guardrails in the prototype', 'Designed to keep the demo flow small and auditable—not a production-ready payment service.')
    items = [
        'No custody: tokens move from payer directly to merchant.',
        'Fixed invoice amount; no zero-value or duplicate payment.',
        'Unknown invoices and merchant self-payment are rejected.',
        'Failed token transfers revert invoice state atomically.',
        'CLI refuses to sign unless the configured RPC reports chain ID 44005.',
    ]
    y = 294
    for i, line in enumerate(items):
        d.ellipse((117, y+6, 136, y+25), fill=TEAL if i < 4 else BLUE)
        d.text((159, y), line, font=REG(21), fill=WHITE)
        y += 48
    return im


def scene4():
    im, d = base(4, 'Observed local demo result', 'The run below exercised the real Checkout.sol contract against an in-memory mock token on Ganache.')
    transcript = [
        'LOCAL PROTOTYPE DEMO — mock six-decimal token',
        'Local chain: 31337',
        'Invoice: #1 for 12.34 mUSD8',
        'Payment: invoice #1 marked paid',
        'Payer balance after: 0.0 mUSD8',
        'Merchant received: 12.34 mUSD8',
        'DEMO COMPLETE — local test only',
    ]
    d.rounded_rectangle((108, 292, 1173, 526), radius=15, fill=(5, 11, 21), outline=(45, 69, 101), width=2)
    y = 312
    for idx, line in enumerate(transcript):
        color = TEAL if idx in (0, 6) else WHITE
        d.text((140, y), line, font=MONO(20), fill=color)
        y += 29
    return im


def scene5():
    im, d = base(5, 'Local verification', 'Five automated tests plus a clean compile; all checks used only the local in-memory EVM.')
    d.rounded_rectangle((110, 295, 1172, 505), radius=18, fill=(12, 23, 42), outline=(41, 59, 88), width=2)
    d.text((154, 333), '5 tests passed', font=BOLD(40), fill=TEAL)
    d.text((154, 401), '0 failures', font=BOLD(31), fill=WHITE)
    d.text((631, 338), 'Exact settlement · duplicate payment · unknown invoice', font=REG(18), fill=WHITE)
    d.text((631, 374), 'Zero address · missing allowance rollback + retry', font=REG(18), fill=WHITE)
    d.text((631, 432), 'Solidity creation bytecode: 1,529 bytes', font=MONO(18), fill=BLUE)
    return im


def scene6():
    im, d = base(6, 'Aevum status: funding still blocks', 'Read-only checks confirm the official token; the fresh test wallet still has no test funds.')
    d.rounded_rectangle((110, 298, 1172, 505), radius=18, fill=(12, 23, 42), outline=(41, 59, 88), width=2)
    d.text((153, 326), 'Aevum chain ID', font=REG(20), fill=MUTED)
    d.text((153, 362), '44005', font=BOLD(29), fill=WHITE)
    d.text((462, 326), 'Fresh wallet balance', font=REG(20), fill=MUTED)
    d.text((462, 362), '0 tQDAY  ·  0 tUSD8', font=BOLD(25), fill=WHITE)
    d.text((153, 427), 'No contract deployed. No testnet payment. No mainnet funds used.', font=BOLD(20), fill=AMBER)
    d.text((153, 463), 'Live Aevum demo and on-chain evidence are still outstanding.', font=REG(19), fill=RED)
    return im


def main():
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/workspace/qday-local-mock-demo.mp4')
    output.parent.mkdir(parents=True, exist_ok=True)
    scenes = [scene1, scene2, scene3, scene4, scene5, scene6]
    with tempfile.TemporaryDirectory(prefix='qday-demo-') as tmp:
        tmp_path = Path(tmp)
        frame_paths = []
        for i, draw_fn in enumerate(scenes, start=1):
            p = tmp_path / f'scene-{i:02}.png'
            save_frame(p, draw_fn, i)
            frame_paths.append(p)
        concat = tmp_path / 'frames.txt'
        with concat.open('w', encoding='utf-8') as f:
            for p in frame_paths:
                f.write(f"file '{p.as_posix()}'\n")
                f.write('duration 6\n')
            f.write(f"file '{frame_paths[-1].as_posix()}'\n")
        command = [
            'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
            '-f', 'concat', '-safe', '0', '-i', str(concat),
            '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium',
            '-crf', '22', '-movflags', '+faststart', str(output),
        ]
        subprocess.run(command, check=True)
    print(f'Rendered {output}')
    print('Silent 36-second slide summary of the local mock demo; not a screen recording or live Aevum evidence.')


if __name__ == '__main__':
    main()
