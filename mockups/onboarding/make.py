PATTERN = "<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90' viewBox='0 0 90 90'><g fill='none' stroke='%23d9a441' stroke-opacity='.22' stroke-width='1.2'><path d='M45 6l12 22 25 3-18 17 5 25-24-12-24 12 5-25L8 31l25-3z'/><circle cx='45' cy='45' r='9'/></g></svg>"


def page(css, phones):
    return ("<!doctype html><meta charset=utf-8><style>"
            "*{box-sizing:border-box;margin:0;padding:0} body{background:#ececec;display:flex;gap:28px;padding:28px;font-family:'Segoe UI',system-ui,sans-serif}"
            ".ph{width:390px;height:844px;border-radius:44px;overflow:hidden;position:relative;box-shadow:0 20px 50px rgba(0,0,0,.28);flex:none}"
            + css + "</style>" + phones)


# ---------- A: Ночной изумруд, арка михраба, золотое свечение ----------
A_css = """
.ph{background:radial-gradient(120% 70% at 50% 0%,#1f8a5f 0%,#0e4a31 45%,#08241a 100%);color:#fff}
.ph:before{content:'';position:absolute;inset:0;background:url("data:image/svg+xml;utf8,""" + PATTERN + """");opacity:.9}
.arch{position:absolute;left:50%;top:70px;width:250px;height:330px;transform:translateX(-50%);border-radius:125px 125px 18px 18px;
 background:linear-gradient(180deg,#134e38,#0a2b1f);border:3px solid #e6b95a;box-shadow:0 0 0 8px rgba(230,185,90,.14),0 0 70px 10px rgba(230,185,90,.35),inset 0 -40px 60px rgba(0,0,0,.45)}
.arch:after{content:'';position:absolute;inset:14px;border-radius:112px 112px 10px 10px;border:1.5px solid rgba(230,185,90,.55)}
.glyph{position:absolute;left:0;right:0;top:140px;text-align:center;font-size:96px;color:#f4d98a;text-shadow:0 6px 0 #b8862b,0 0 40px rgba(244,217,138,.7);font-family:'Traditional Arabic','Sakkal Majalla',serif}
.t{position:absolute;left:28px;right:28px;bottom:180px;text-align:center}
.t h1{font-size:30px;font-weight:800;line-height:1.15} .t p{margin-top:10px;font-size:15.5px;color:rgba(255,255,255,.75);line-height:1.45}
.btn{position:absolute;left:24px;right:24px;bottom:56px;height:60px;border-radius:30px;background:linear-gradient(180deg,#f0c765,#d19a33);color:#2a1c00;font-weight:800;font-size:18px;display:grid;place-items:center;box-shadow:0 12px 30px rgba(217,164,65,.45)}
.skip{position:absolute;left:0;right:0;bottom:22px;text-align:center;font-size:14px;color:rgba(255,255,255,.6)}
.dots{position:absolute;top:34px;left:0;right:0;display:flex;justify-content:center;gap:7px} .dots i{width:26px;height:5px;border-radius:3px;background:rgba(255,255,255,.25)} .dots i.on{background:#e6b95a}
.q{position:absolute;left:24px;right:24px;top:96px} .q small{color:#e6b95a;font-weight:700;letter-spacing:.08em;font-size:12.5px} .q h2{font-size:27px;margin-top:8px;line-height:1.2;font-weight:800}
.opts{position:absolute;left:20px;right:20px;top:240px;display:grid;gap:12px}
.o{padding:18px 18px;border-radius:22px;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.14);display:flex;gap:14px;align-items:center;font-size:17px;font-weight:700}
.o .ic{width:46px;height:46px;border-radius:15px;background:linear-gradient(145deg,#f0c765,#b8862b);display:grid;place-items:center;font-size:22px;box-shadow:0 6px 14px rgba(0,0,0,.35)}
.o small{display:block;font-weight:500;color:rgba(255,255,255,.62);font-size:13.5px;margin-top:2px}
.o.on{background:rgba(230,185,90,.16);border-color:#e6b95a;box-shadow:0 0 0 4px rgba(230,185,90,.12)}
"""
A_html = """
<div class=ph><div class=arch></div><div class=glyph>قرآن</div>
<div class=t><h1>Добро пожаловать</h1><p>Коран, хадисы и азкары в одном приложении. Настроим всё под вас за минуту.</p></div>
<div class=btn>Начать</div><div class=skip>Пропустить</div></div>
<div class=ph><div class=dots><i class=on></i><i class=on></i><i></i><i></i><i></i></div>
<div class=q><small>ВОПРОС 2 ИЗ 5</small><h2>Что вы уже знаете наизусть из Корана?</h2></div>
<div class=opts>
<div class=o><div class=ic>۞</div><div>Пока ничего<small>Начнём с самого простого</small></div></div>
<div class='o on'><div class=ic>☪</div><div>Короткие суры<small>Аль-Фатиха, Аль-Ихлас…</small></div></div>
<div class=o><div class=ic>✦</div><div>Часть джуза 30<small>Несколько сур для намаза</small></div></div>
<div class=o><div class=ic>❂</div><div>Больше<small>Продолжу с того места</small></div></div></div>
<div class=btn>Далее</div><div class=skip>Пропустить опросник</div></div>"""

# ---------- B: Светлый пергамент, объёмные карточки ----------
B_css = """
.ph{background:linear-gradient(180deg,#faf5e8,#f1e7cf);color:#1d2a22}
.blob{position:absolute;border-radius:50%}
.b1{width:330px;height:330px;left:-90px;top:-80px;background:radial-gradient(circle at 35% 30%,#3aa77b,#13704B 60%,#0c4a32);box-shadow:0 30px 60px rgba(19,112,75,.35)}
.b2{width:150px;height:150px;right:-30px;top:210px;background:radial-gradient(circle at 30% 30%,#ffe9a8,#d9a441 60%,#9a6b14);box-shadow:0 22px 40px rgba(154,107,20,.4)}
.card3d{position:absolute;left:58px;top:130px;width:230px;height:290px;border-radius:30px;background:linear-gradient(160deg,#fff,#f7efe0);transform:rotate(-6deg);box-shadow:0 30px 50px rgba(40,30,0,.22),0 0 0 1px rgba(217,164,65,.4);display:grid;place-items:center}
.card3d span{font-size:84px;color:#13704B;font-family:'Traditional Arabic',serif;text-shadow:0 5px 0 rgba(217,164,65,.5)}
.card3d:after{content:'';position:absolute;inset:12px;border-radius:22px;border:1.5px dashed rgba(217,164,65,.7)}
.t{position:absolute;left:28px;right:28px;bottom:170px} .t h1{font-size:31px;font-weight:800;line-height:1.12} .t p{margin-top:10px;font-size:16px;color:#5b6a60;line-height:1.45}
.btn{position:absolute;left:24px;right:24px;bottom:50px;height:62px;border-radius:22px;background:#13704B;color:#fff;font-weight:800;font-size:18px;display:grid;place-items:center;box-shadow:0 14px 28px rgba(19,112,75,.4),inset 0 -4px 0 rgba(0,0,0,.18)}
.skip{position:absolute;left:0;right:0;bottom:18px;text-align:center;font-size:14px;color:#8a8f7f}
.bar{position:absolute;top:44px;left:24px;right:24px;height:8px;border-radius:4px;background:rgba(19,112,75,.15)} .bar i{display:block;height:100%;width:40%;border-radius:4px;background:linear-gradient(90deg,#13704B,#d9a441)}
.q{position:absolute;left:24px;right:24px;top:84px} .q h2{font-size:28px;line-height:1.18;font-weight:800} .q p{margin-top:8px;color:#6a7468;font-size:15px}
.opts{position:absolute;left:20px;right:20px;top:240px;display:grid;gap:14px}
.o{padding:18px;border-radius:24px;background:#fffdf7;display:flex;gap:14px;align-items:center;font-size:17px;font-weight:700;box-shadow:0 10px 22px rgba(60,45,10,.12),0 0 0 1px rgba(217,164,65,.25)}
.o .ic{width:50px;height:50px;border-radius:50%;background:radial-gradient(circle at 30% 28%,#4fbf90,#13704B);color:#fff;display:grid;place-items:center;font-size:22px;box-shadow:0 8px 14px rgba(19,112,75,.35),inset 0 -5px 8px rgba(0,0,0,.2)}
.o small{display:block;font-weight:500;color:#7a8276;font-size:13.5px;margin-top:2px}
.o.on{background:#e9f5ee;box-shadow:0 0 0 2.5px #13704B,0 12px 24px rgba(19,112,75,.25)}
"""
B_html = """
<div class=ph><div class='blob b1'></div><div class='blob b2'></div><div class=card3d><span>قرآن</span></div>
<div class=t><h1>Коран и Сунна<br>рядом каждый день</h1><p>Читайте, слушайте и заучивайте. Расскажите о себе, и мы составим план.</p></div>
<div class=btn>Начать</div><div class=skip>Пропустить</div></div>
<div class=ph><div class=bar><i></i></div>
<div class=q><h2>Что вы уже знаете из Корана?</h2><p>Это поможет выбрать, с чего начать</p></div>
<div class=opts>
<div class=o><div class=ic>0</div><div>Пока ничего<small>Начнём с самого простого</small></div></div>
<div class='o on'><div class=ic>✓</div><div>Короткие суры<small>Аль-Фатиха, Аль-Ихлас…</small></div></div>
<div class=o><div class=ic>30</div><div>Часть джуза 30<small>Несколько сур для намаза</small></div></div>
<div class=o><div class=ic>+</div><div>Больше<small>Продолжу с того места</small></div></div></div>
<div class=btn>Далее</div><div class=skip>Пропустить опросник</div></div>"""

# ---------- C: тёмное стекло и золотая аврора ----------
C_css = """
.ph{background:#0c0f0e;color:#fff}
.aur1{position:absolute;width:420px;height:420px;left:-140px;top:-100px;border-radius:50%;background:radial-gradient(circle,rgba(19,170,110,.75),transparent 65%);filter:blur(30px)}
.aur2{position:absolute;width:380px;height:380px;right:-160px;top:180px;border-radius:50%;background:radial-gradient(circle,rgba(217,164,65,.6),transparent 65%);filter:blur(34px)}
.ring{position:absolute;left:50%;top:120px;width:260px;height:260px;transform:translateX(-50%);border-radius:50%;border:2px solid rgba(244,217,138,.6);box-shadow:0 0 60px rgba(244,217,138,.3),inset 0 0 60px rgba(244,217,138,.18);display:grid;place-items:center;background:rgba(255,255,255,.04)}
.ring:before{content:'';position:absolute;inset:18px;border-radius:50%;border:1px dashed rgba(244,217,138,.5)}
.ring span{font-size:92px;font-family:'Traditional Arabic',serif;color:#f4d98a;text-shadow:0 0 30px rgba(244,217,138,.8)}
.t{position:absolute;left:28px;right:28px;bottom:178px;text-align:center} .t h1{font-size:30px;font-weight:800;line-height:1.15} .t p{margin-top:10px;font-size:15.5px;color:rgba(255,255,255,.7);line-height:1.45}
.btn{position:absolute;left:24px;right:24px;bottom:54px;height:60px;border-radius:30px;background:linear-gradient(90deg,#16a974,#e0b04e);color:#06130d;font-weight:800;font-size:18px;display:grid;place-items:center;box-shadow:0 10px 34px rgba(22,169,116,.45)}
.skip{position:absolute;left:0;right:0;bottom:20px;text-align:center;font-size:14px;color:rgba(255,255,255,.5)}
.step{position:absolute;top:44px;left:24px;right:24px;display:flex;justify-content:space-between;color:rgba(255,255,255,.6);font-size:14px} .step b{color:#f4d98a}
.q{position:absolute;left:24px;right:24px;top:96px} .q h2{font-size:28px;line-height:1.18;font-weight:800}
.opts{position:absolute;left:20px;right:20px;top:236px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.o{height:150px;padding:16px;border-radius:26px;background:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.18);display:flex;flex-direction:column;justify-content:space-between;font-size:16.5px;font-weight:700;box-shadow:0 14px 30px rgba(0,0,0,.4)}
.o .ic{width:48px;height:48px;border-radius:16px;background:linear-gradient(145deg,rgba(22,169,116,.9),rgba(224,176,78,.9));display:grid;place-items:center;font-size:22px;color:#06130d;box-shadow:0 8px 18px rgba(22,169,116,.4)}
.o small{display:block;font-weight:500;color:rgba(255,255,255,.6);font-size:12.5px;margin-top:3px}
.o.on{border-color:#f4d98a;background:linear-gradient(160deg,rgba(244,217,138,.28),rgba(22,169,116,.12));box-shadow:0 0 36px rgba(244,217,138,.3),0 14px 30px rgba(0,0,0,.4)}
"""
C_html = """
<div class=ph><div class=aur1></div><div class=aur2></div><div class=ring><span>قرآن</span></div>
<div class=t><h1>Ваш путь к Корану<br>и Сунне</h1><p>Небольшой опрос, и мы подготовим личный план обучения.</p></div>
<div class=btn>Начать</div><div class=skip>Пропустить</div></div>
<div class=ph><div class=aur1></div><div class=aur2></div><div class=step><span>Шаг <b>2</b> из 5</span><span>Пропустить</span></div>
<div class=q><h2>Что вы уже знаете из Корана?</h2></div>
<div class=opts>
<div class=o><div class=ic>0</div><div>Пока ничего<small>С самого начала</small></div></div>
<div class='o on'><div class=ic>✓</div><div>Короткие суры<small>Аль-Фатиха, Аль-Ихлас</small></div></div>
<div class=o><div class=ic>30</div><div>Часть джуза 30<small>Суры для намаза</small></div></div>
<div class=o><div class=ic>+</div><div>Больше<small>Продолжу дальше</small></div></div></div>
<div class=btn>Далее</div></div>"""

for name, css, html in (('A-nochnoi-izumrud', A_css, A_html), ('B-pergament-obyom', B_css, B_html), ('C-steklo-avrora', C_css, C_html)):
    open(name + '.html', 'w', encoding='utf-8').write(page(css, html))

from playwright.sync_api import sync_playwright
import os
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 880, 'height': 900}, device_scale_factor=1.5)
    for name in ('A-nochnoi-izumrud', 'B-pergament-obyom', 'C-steklo-avrora'):
        pg.goto('file:///' + os.path.abspath(name + '.html').replace('\\', '/'))
        pg.wait_for_timeout(500)
        pg.screenshot(path=name + '.png')
    b.close()
print('ok')
