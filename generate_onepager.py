#!/usr/bin/env python3
"""
Pat Fellows — LA-Ready One Pager Generator
-------------------------------------------
Run this script in the same folder as your photos:
  - pat_headshot.jpg    (the Ryerson blue jersey photo)
  - pat_action.png      (the Erie Otters celebration shot)
  - ron_fellows.png     (Ron Fellows in the Corvette Racing suit)

Then run:
  pip install weasyprint
  python3 generate_onepager.py

Output: pat_fellows_onepager.pdf
"""

import base64
import os
import sys
from pathlib import Path

# ─── CONFIG ────────────────────────────────────────────────────────────────────
OUTPUT_FILE = "pat_fellows_onepager.pdf"

PHOTO_HEADSHOT  = "pat_headshot.jpg"    # Main portrait — Ryerson jersey
PHOTO_ACTION    = "pat_action.png"      # Erie Otters celebration
PHOTO_RON       = "ron_fellows.png"     # Ron Fellows racing suit

# ─── HELPERS ───────────────────────────────────────────────────────────────────
def img_to_b64(path: str, mime: str) -> str:
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime};base64,{data}"

def check_files():
    missing = []
    for f in [PHOTO_HEADSHOT, PHOTO_ACTION, PHOTO_RON]:
        if not Path(f).exists():
            missing.append(f)
    if missing:
        print("❌  Missing photo files:")
        for m in missing:
            print(f"    → {m}")
        print("\nRename your photos to match the filenames above and re-run.")
        sys.exit(1)

# ─── MAIN ──────────────────────────────────────────────────────────────────────
def build():
    check_files()

    print("📸  Loading photos...")
    headshot_ext = PHOTO_HEADSHOT.split(".")[-1].lower()
    mime_headshot = "image/jpeg" if headshot_ext in ("jpg", "jpeg") else "image/png"
    mime_action   = "image/png"
    mime_ron      = "image/png"

    headshot_src = img_to_b64(PHOTO_HEADSHOT, mime_headshot)
    action_src   = img_to_b64(PHOTO_ACTION,   mime_action)
    ron_src      = img_to_b64(PHOTO_RON,      mime_ron)

    print("🎨  Building HTML...")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');

* {{ margin: 0; padding: 0; box-sizing: border-box; }}

:root {{
  --black:     #080808;
  --white:     #f4f1eb;
  --gold:      #c9a84c;
  --gold-dim:  rgba(201,168,76,0.25);
  --mid:       #161616;
  --muted:     rgba(244,241,235,0.45);
  --body:      rgba(244,241,235,0.72);
}}

html, body {{
  width: 816px;
  background: var(--black);
  color: var(--white);
  font-family: 'DM Sans', sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}}

.page {{
  width: 816px;
  min-height: 1056px;
  padding: 46px 52px 40px;
  display: flex;
  flex-direction: column;
  gap: 0;
  background:
    radial-gradient(ellipse 60% 40% at 90% 0%,   rgba(201,168,76,0.07) 0%, transparent 100%),
    radial-gradient(ellipse 40% 30% at 5%  100%,  rgba(201,168,76,0.04) 0%, transparent 100%),
    var(--black);
}}

/* ── TOP BAR ── */
.top-bar {{
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}}
.badge {{
  font-family: 'Bebas Neue', sans-serif;
  font-size: 10.5px;
  letter-spacing: 4px;
  color: var(--gold);
  border: 1px solid var(--gold-dim);
  padding: 4px 13px;
  text-transform: uppercase;
}}
.rep-tag {{
  font-size: 9.5px;
  letter-spacing: 2.5px;
  color: var(--muted);
  text-transform: uppercase;
  font-weight: 300;
}}

/* ── HERO ── */
.hero {{
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 36px;
  align-items: start;
  margin-bottom: 30px;
}}

.name-block {{ margin-bottom: 14px; }}
.first {{
  font-family: 'Cormorant Garamond', serif;
  font-size: 76px;
  font-weight: 700;
  line-height: 0.88;
  color: var(--white);
  display: block;
  letter-spacing: -1px;
}}
.last {{
  font-family: 'Bebas Neue', sans-serif;
  font-size: 90px;
  line-height: 0.82;
  color: var(--gold);
  display: block;
  letter-spacing: 3px;
}}
.craft-line {{
  font-size: 9.5px;
  letter-spacing: 5px;
  text-transform: uppercase;
  color: var(--muted);
  margin-top: 13px;
  font-weight: 300;
}}
.rule {{
  width: 48px;
  height: 1px;
  background: var(--gold);
  margin: 15px 0;
}}
.logline {{
  font-size: 13px;
  line-height: 1.78;
  color: var(--body);
  font-weight: 300;
  max-width: 380px;
}}

/* ── PHOTOS ── */
.photos {{
  display: grid;
  grid-template-rows: 1fr 1fr;
  gap: 8px;
  height: 340px;
}}
.photo-wrap {{
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(201,168,76,0.18);
}}
.photo-wrap img {{
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: grayscale(12%) contrast(1.04);
}}
.photo-wrap.headshot img  {{ object-position: center 15%; }}
.photo-wrap.action  img   {{ object-position: center 25%; }}
.cap {{
  position: absolute;
  bottom: 7px;
  left: 10px;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 9.5px;
  letter-spacing: 2.5px;
  color: var(--gold);
  z-index: 2;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
}}

/* ── STORY ── */
.story-grid {{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}}
.story-block {{
  border-left: 2px solid var(--gold-dim);
  padding-left: 15px;
}}
.block-label {{
  font-family: 'Bebas Neue', sans-serif;
  font-size: 9.5px;
  letter-spacing: 4px;
  color: var(--gold);
  margin-bottom: 7px;
}}
.story-block p {{
  font-size: 12px;
  line-height: 1.74;
  color: var(--body);
  font-weight: 300;
}}
.story-block p strong {{ color: var(--white); font-weight: 500; }}

/* ── LEGACY ── */
.legacy {{
  display: flex;
  align-items: center;
  gap: 18px;
  background: rgba(201,168,76,0.04);
  border: 1px solid rgba(201,168,76,0.12);
  padding: 16px 20px;
  margin-bottom: 24px;
}}
.ron-photo {{
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--gold-dim);
}}
.ron-photo img {{
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(25%);
}}
.legacy-label {{
  font-family: 'Bebas Neue', sans-serif;
  font-size: 9.5px;
  letter-spacing: 4px;
  color: var(--gold);
  margin-bottom: 6px;
}}
.legacy p {{
  font-size: 12px;
  line-height: 1.68;
  color: var(--body);
  font-weight: 300;
}}
.legacy p strong {{ color: var(--white); font-weight: 500; }}

/* ── SCRIPTS ── */
.section-label {{
  font-family: 'Bebas Neue', sans-serif;
  font-size: 9.5px;
  letter-spacing: 5px;
  color: var(--gold);
  margin-bottom: 12px;
  text-transform: uppercase;
}}
.scripts {{
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 18px;
}}
.script {{
  background: var(--mid);
  border: 1px solid rgba(255,255,255,0.05);
  padding: 16px 18px;
  position: relative;
  overflow: hidden;
}}
.script::before {{
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 3px; height: 100%;
  background: var(--gold);
}}
.script-name {{
  font-family: 'Cormorant Garamond', serif;
  font-size: 19px;
  font-weight: 700;
  color: var(--white);
  margin-bottom: 3px;
  letter-spacing: 0.3px;
}}
.script-fmt {{
  font-size: 8.5px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 8px;
  font-weight: 500;
}}
.script p {{
  font-size: 11px;
  line-height: 1.65;
  color: var(--muted);
  font-weight: 300;
}}

/* ── COLLAB ── */
.collab {{
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 11px 17px;
  border: 1px solid rgba(255,255,255,0.05);
  background: rgba(255,255,255,0.015);
  margin-bottom: 26px;
}}
.dot {{
  width: 5px; height: 5px;
  background: var(--gold);
  border-radius: 50%;
  flex-shrink: 0;
}}
.collab p {{
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 300;
}}
.collab p strong {{ color: var(--white); font-weight: 500; }}

/* ── FOOTER ── */
.footer {{
  margin-top: auto;
  padding-top: 18px;
  border-top: 1px solid rgba(201,168,76,0.18);
  display: flex;
  justify-content: space-between;
  align-items: center;
}}
.footer-left span {{
  display: block;
}}
.f-label {{
  font-size: 8.5px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 300;
  margin-bottom: 2px;
}}
.f-name {{
  font-family: 'Bebas Neue', sans-serif;
  font-size: 15px;
  letter-spacing: 2px;
  color: var(--white);
}}
.footer-right {{ text-align: right; }}
.footer-right p {{
  font-size: 10.5px;
  color: var(--muted);
  line-height: 1.9;
  font-weight: 300;
}}
.footer-right a {{ color: var(--gold); text-decoration: none; }}
.copy {{
  font-family: 'Bebas Neue', sans-serif;
  font-size: 8.5px;
  letter-spacing: 3px;
  color: rgba(201,168,76,0.12);
  text-align: center;
  padding-top: 8px;
}}
</style>
</head>
<body>
<div class="page">

  <!-- TOP BAR -->
  <div class="top-bar">
    <div class="badge">Writer · Toronto, Canada</div>
    <div class="rep-tag">Represented by JMPF Management</div>
  </div>

  <!-- HERO -->
  <div class="hero">
    <div class="hero-left">
      <div class="name-block">
        <span class="first">Patrick</span>
        <span class="last">Fellows</span>
      </div>
      <div class="craft-line">Screenwriter &nbsp;·&nbsp; Comedy &nbsp;·&nbsp; Drama</div>
      <div class="rule"></div>
      <p class="logline">A former OHL champion who chose the blank page over the easy road. Patrick Fellows writes characters that feel real because he's lived among them — and his voice is unlike anything in the Canadian market right now.</p>
    </div>

    <div class="photos">
      <div class="photo-wrap headshot">
        <img src="{headshot_src}" alt="Patrick Fellows">
        <span class="cap">TMU Rams</span>
      </div>
      <div class="photo-wrap action">
        <img src="{action_src}" alt="Patrick Fellows — Erie Otters">
        <span class="cap">Erie Otters · OHL Champs 2017</span>
      </div>
    </div>
  </div>

  <!-- STORY -->
  <div class="story-grid">
    <div class="story-block">
      <div class="block-label">The Athlete</div>
      <p>Drafted to the <strong>Erie Otters (OHL)</strong> in 2013, Pat played four seasons including the historic <strong>2016–17 OHL Championship</strong> team. He skated alongside <strong>Connor McDavid</strong> and was recruited by the <strong>LA Kings</strong> before injury ended his playing career.</p>
    </div>
    <div class="story-block">
      <div class="block-label">The Pivot</div>
      <p>After hockey Pat chose <strong>Ryerson University's film program</strong> over every door his family name could have opened. He turned the discipline of elite sport into craft. No safety net — just the calling. His writing is uncompromising, original, and built to last.</p>
    </div>
  </div>

  <!-- LEGACY -->
  <div class="legacy">
    <div class="ron-photo">
      <img src="{ron_src}" alt="Ron Fellows">
    </div>
    <div>
      <div class="legacy-label">The Legacy He Chose Not To Take</div>
      <p>His father <strong>Ron Fellows</strong> is a Canadian motorsport legend — <strong>Order of Canada</strong> recipient, <strong>Canadian Motorsport Hall of Fame</strong> inductee, and one of few Canadians to race in both the <strong>NASCAR Cup Series</strong> and <strong>Le Mans 24 Hours</strong>. Pat could have walked straight into that world. He built his own instead.</p>
    </div>
  </div>

  <!-- SCRIPTS -->
  <div class="section-label">Current Projects</div>
  <div class="scripts">
    <div class="script">
      <div class="script-name">Jungle Gym</div>
      <div class="script-fmt">Half-Hour Ensemble Comedy · Pilot</div>
      <p>A chaotic indie gym's soft opening day becomes a livestreamed disaster. Sharp ensemble, original tone, dialogue that sounds like nothing else on television right now.</p>
    </div>
    <div class="script">
      <div class="script-name">Father Material</div>
      <div class="script-fmt">Half-Hour Comedy · Pilot</div>
      <p>Pat's second original pilot. A distinct voice, fresh premise, and the same commitment to characters that feel lived-in and completely real. Available upon request.</p>
    </div>
  </div>

  <!-- COLLAB -->
  <div class="collab">
    <div class="dot"></div>
    <p>Currently collaborating with <strong>Sean Cullen</strong> — Canadian writer and actor with established TV and film credits — who sought Pat out after reading his work.</p>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-left">
      <span class="f-label">Management</span>
      <span class="f-name">JMPF Management</span>
    </div>
    <div class="footer-right">
      <p><a href="mailto:jmpf.managment@gmail.com">jmpf.managment@gmail.com</a></p>
      <p>647-880-8111</p>
    </div>
  </div>
  <div class="copy">© Patrick Fellows 2026 — Confidential</div>

</div>
</body>
</html>"""

    with open("pat_fellows_onepager.html", "w") as f:
        f.write(html)
    print("✅  HTML written")

    try:
        from weasyprint import HTML
        print("🖨   Generating PDF...")
        HTML(filename="pat_fellows_onepager.html").write_pdf(OUTPUT_FILE)
        print(f"✅  PDF saved → {OUTPUT_FILE}")
        os.remove("pat_fellows_onepager.html")
    except ImportError:
        print("⚠️   weasyprint not found. Install it with:")
        print("     pip install weasyprint")
        print(f"\n     HTML saved as pat_fellows_onepager.html")
        print("     You can also open the HTML in Chrome and Print → Save as PDF")

if __name__ == "__main__":
    build()
