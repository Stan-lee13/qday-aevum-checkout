#!/usr/bin/env python3
"""Render a silent, slide-based summary of documented Aevum Testnet evidence.

The transaction identifiers and outcomes are transcribed from README.md. This
is not a screen recording and does not make or imply a new transaction.
Requires Pillow and ffmpeg.
"""
from pathlib import Path
import subprocess
import sys
import tempfile
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 720
BG=(9,15,30); PANEL=(18,28,48); WHITE=(237,243,250); MUTED=(163,178,199)
TEAL=(68,215,190); BLUE=(110,165,255); AMBER=(255,194,92); RED=(255,130,125)
FONT_DIR=Path('/usr/share/fonts/truetype/dejavu')
def font(file,size):
    try: return ImageFont.truetype(str(FONT_DIR/file),size)
    except OSError: return ImageFont.load_default()
def draw_base(n,title,subtitle):
    im=Image.new('RGB',(W,H),BG); d=ImageDraw.Draw(im)
    d.rounded_rectangle((42,35,1238,685),radius=24,fill=PANEL,outline=(41,59,88),width=2)
    d.text((78,59),'QDAY AEVUM CHECKOUT  /  TESTNET EVIDENCE',font=font('DejaVuSans-Bold.ttf',17),fill=TEAL)
    d.text((78,100),title,font=font('DejaVuSans-Bold.ttf',36),fill=WHITE)
    d.text((80,155),subtitle,font=font('DejaVuSans.ttf',19),fill=MUTED)
    d.line((78,627,1202,627),fill=(47,64,91),width=2)
    d.text((78,648),'HISTORICAL README-DOCUMENTED TESTNET RESULT  ·  NO NEW TRANSACTION',font=font('DejaVuSans-Bold.ttf',14),fill=AMBER)
    d.text((1150,648),f'{n}/7',font=font('DejaVuSansMono.ttf',14),fill=MUTED)
    return im,d
def text(d,x,y,s,size=20,color=WHITE,bold=False,mono=False):
    name='DejaVuSansMono.ttf' if mono else ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')
    d.text((x,y),s,font=font(name,size),fill=color)
def box(d,xy,fill=(12,23,42)):
    d.rounded_rectangle(xy,radius=14,fill=fill,outline=(41,59,88),width=2)
def row(d,y,label,value,sz=20):
    text(d,110,y,label,17,BLUE,True); text(d,350,y,value,sz)
def scene1():
    im,d=draw_base(1,'Invoice checkout, end to end','A prototype for fixed-amount ERC-20 invoice payments. This demo summarizes documented evidence.')
    box(d,(104,246,1174,503))
    for x,head,body in [(140,'MERCHANT','Creates invoice #1'),(500,'PAYER','Approves exact amount'),(867,'CHECKOUT','Settles directly')]:
        text(d,x,293,head,18,TEAL,True); text(d,x,344,body,23)
    text(d,420,343,'→',30,BLUE,True); text(d,788,343,'→',30,BLUE,True)
    text(d,145,423,'Amount: 2.50 tUSD8   ·   Token transfer is payer → merchant',20,MUTED)
    text(d,145,466,'Contract holds no tokens and charges no fee (README).',18,WHITE)
    return im
def scene2():
    im,d=draw_base(2,'What the CLI and contract do','README-described workflow; the video does not execute these steps.')
    box(d,(105,235,1175,530))
    items=[('01  INVOICE','Merchant runs invoice <amount>; contract records a unique invoice.'),('02  APPROVAL','Payer approves exactly the invoice amount.'),('03  PAY','CLI checks RPC chain ID 44005, then pays invoice.'),('04  SETTLE','Contract calls transferFrom(payer, merchant, amount).')]
    y=264
    for h,b in items:
        text(d,137,y,h,17,TEAL,True); text(d,365,y,b,20); y+=59
    text(d,138,500,'InvoicePaid + ERC-20 Transfer events provide settlement evidence.',17,MUTED)
    return im
def scene3():
    im,d=draw_base(3,'Aevum Testnet: completed payment documented','README reports read-only checks at block 3,431,749; all listed receipts returned success.')
    box(d,(105,225,1175,535))
    row(d,255,'NETWORK','QDay Aevum Testnet · chain ID 44005')
    row(d,300,'INVOICE','1 · 2.50 tUSD8')
    row(d,345,'CONTRACT','0xF836126eefb455BAB211B2c010B4b8d018a586Ee',18)
    row(d,390,'TOKEN','tUSD8 · 0x456569838f1d43009A91ebA4263147Afd7233483',17)
    text(d,110,445,'Payment receipt',17,BLUE,True)
    text(d,350,443,'0xfc4e7acd5d9f66c751129735c1177460d4a391b8',17,WHITE,False,True)
    text(d,350,470,'e897c968dc9a4aa740133918  ·  block 3,431,709',17,WHITE,False,True)
    text(d,110,508,'README says InvoicePaid + token Transfer confirm settlement to merchant.',16,MUTED)
    return im
def scene4():
    im,d=draw_base(4,'Transaction trail (historical receipts)','These IDs identify the documented prior run; no transaction is being sent in this video.')
    box(d,(105,222,1175,545))
    rows=[('DEPLOY · 3,431,610','0x22ad0ce11315ad4056e6a57c517d531a54a8ddf318dc2928bb9800d8ff460613'),('INVOICE · 3,431,682','0xa786fa3e45efd1a9a6f28478864a9ba34d61dc5dcabaa33adc2751eeb80da631'),('APPROVAL · 3,431,699','0x1d6f0af146c4f238616c40e82781951b77303417c0f0a8ccafc6dc0ce8d8a654'),('PAY · 3,431,709','0xfc4e7acd5d9f66c751129735c1177460d4a391b8e897c968dc9a4aa740133918')]
    y=248
    for label,tx in rows:
        text(d,130,y,label,16,TEAL,True); text(d,130,y+25,tx,16,WHITE,False,True); y+=71
    text(d,130,520,'All six receipts (including two test-funding transfers) are listed in README.',16,MUTED)
    return im
def scene5():
    im,d=draw_base(5,'Test settlement and direct transfer','Balances and event interpretation are reported in the project README.')
    box(d,(105,240,1175,520))
    text(d,140,275,'PAYER',18,BLUE,True); text(d,140,315,'7.5 tUSD8',28,WHITE,True)
    text(d,632,275,'MERCHANT',18,BLUE,True); text(d,632,315,'42.5 tUSD8',28,WHITE,True)
    text(d,140,380,'Payment amount',18,MUTED); text(d,400,377,'2.50 tUSD8',23,TEAL,True)
    text(d,140,425,'README: on-chain invoice record names expected merchant and payer;',18,WHITE)
    text(d,140,459,'InvoicePaid and token Transfer agree on invoice #1 and amount.',18,WHITE)
    text(d,140,490,'Test assets only; no mainnet funds.',17,AMBER,True)
    return im
def scene6():
    im,d=draw_base(6,'Observed local prototype run','Output from npm run demo; separate in-memory Ganache mock, NOT Aevum.')
    box(d,(105,225,1175,550))
    lines=['LOCAL PROTOTYPE DEMO — in-memory Ganache + mock token',
           'Local chain: 31337', 'Invoice: #1 for 12.34 mUSD8',
           'Payment: invoice #1 marked paid', 'Payer balance after: 0.0 mUSD8',
           'Merchant received: 12.34 mUSD8',
           'DEMO COMPLETE — local test only; no Aevum payment occurred.']
    y=250
    for i,line in enumerate(lines):
        text(d,135,y,line,18,AMBER if i in (0,6) else WHITE,False,True); y+=38
    text(d,135,527,'This local output is not evidence of Aevum settlement.',16,MUTED)
    return im
def scene7():
    im,d=draw_base(7,'Open source · testnet only · unaudited','Review limitations before treating this educational prototype as anything more.')
    box(d,(105,228,1175,535))
    text(d,140,257,'REPOSITORY',17,BLUE,True)
    text(d,140,286,'https://github.com/Stan-lee13/qday-aevum-checkout',20,WHITE)
    text(d,140,330,'LIMITATIONS',17,BLUE,True)
    items=['Educational prototype; not audited production software.','Contract source is not verified on the explorer.','No custody, refund, partial payment, cancellation, fee or admin key.','See the repository README for reproduction and transaction links.']
    y=361
    for s in items:
        text(d,153,y,'•',20,TEAL,True); text(d,180,y,s,18); y+=37
    text(d,140,520,'Network: QDay Aevum Testnet · chain 44005 · test assets only',16,MUTED)
    return im

def main():
    output=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/workspace/qday-aevum-demo.mp4')
    output.parent.mkdir(parents=True,exist_ok=True)
    scenes=[scene1,scene2,scene3,scene4,scene5,scene6,scene7]
    with tempfile.TemporaryDirectory(prefix='qday-aevum-video-') as tmp:
        tmp=Path(tmp); paths=[]
        for i,fn in enumerate(scenes,1):
            p=tmp/f'{i:02}.png'; fn().save(p,optimize=True); paths.append(p)
        listing=tmp/'frames.txt'
        with listing.open('w') as f:
            for p in paths: f.write(f"file '{p.as_posix()}'\nduration 6\n")
            f.write(f"file '{paths[-1].as_posix()}'\n")
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(listing),'-vf','fps=25,format=yuv420p','-c:v','libx264','-preset','medium','-crf','24','-movflags','+faststart',str(output)],check=True)
    print(f'Rendered {output}')
if __name__=='__main__': main()
