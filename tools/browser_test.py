# Plays RUGD in a real headless Chrome against the local server and saves screenshots.
#   node server.js &   then   python3 tools/browser_test.py [solo|online] [outdir]
import sys, time, os
from playwright.sync_api import sync_playwright

MODE = sys.argv[1] if len(sys.argv) > 1 else 'solo'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/rugd_shots'
URL = 'http://localhost:3000/'
os.makedirs(OUT, exist_ok=True)
errors = []

def watch(page, tag):
    page.on('console', lambda m: m.type == 'error' and errors.append(f'{tag} console: {m.text}'))
    page.on('pageerror', lambda e: errors.append(f'{tag} pageerror: {e}'))

def state(page):
    return page.evaluate("() => V ? {ph: V.ph, rn: V.rn, k: curK(), me: (myP()||{}), rug: V.rug} : null")

def wait_phase(page, ph, timeout=60):
    t = time.time()
    while time.time() - t < timeout:
        s = state(page)
        if s and s['ph'] == ph: return s
        time.sleep(0.2)
    raise SystemExit(f'timed out waiting for {ph}, last state {state(page)}')

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome', args=['--autoplay-policy=no-user-gesture-required'])
    if MODE == 'solo':
        pg = b.new_page(viewport={'width': 1440, 'height': 900}); watch(pg, 'solo')
        pg.goto(URL + '?rug=101'); time.sleep(1.2)
        pg.screenshot(path=f'{OUT}/0_menu.png')
        pg.click('#soloBtn'); time.sleep(1.5)
        pg.screenshot(path=f'{OUT}/1_intro.png')
        wait_phase(pg, 'live'); time.sleep(2)
        pg.keyboard.press('b'); time.sleep(0.3)
        print('after buy', state(pg)['me'].get('co'))
        time.sleep(3); pg.keyboard.press('s'); time.sleep(0.2)
        print('after sell', state(pg)['me'].get('cash'))
        pg.keyboard.press('s'); time.sleep(0.2)   # nope: nothing to sell
        pg.keyboard.press('b'); time.sleep(1.5)
        pg.screenshot(path=f'{OUT}/2_live.png')
        s = wait_phase(pg, 'rugged', 40); time.sleep(2.6)
        print('rugged at tick', s['rug'], 'me rugged?', s['me'].get('rg'))
        pg.screenshot(path=f'{OUT}/3_rug.png')
        wait_phase(pg, 'results', 10); time.sleep(0.8)
        pg.screenshot(path=f'{OUT}/4_results.png')
        wait_phase(pg, 'live', 20); time.sleep(4)
        pg.screenshot(path=f'{OUT}/5_round2.png')
        wait_phase(pg, 'results', 40); print('round 2 rugged?', pg.evaluate('V.res.rugged'))
        s = wait_phase(pg, 'final', 90); time.sleep(1)
        pg.screenshot(path=f'{OUT}/6_final.png')
        print('final rugs', pg.evaluate('V.fin.rugs'), 'winner', pg.evaluate('V.fin.rows[0].n'))
        mp = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True).new_page(); watch(mp, 'mobile')
        mp.goto(URL); mp.click('#soloBtn'); wait_phase(mp, 'live'); time.sleep(3); mp.tap('#buyBtn'); time.sleep(1)
        mp.screenshot(path=f'{OUT}/7_mobile.png')
    else:
        h = b.new_page(viewport={'width': 1280, 'height': 800}); watch(h, 'host')
        g = b.new_context(viewport={'width': 1280, 'height': 800}).new_page(); watch(g, 'guest')
        h.goto(URL); h.fill('#nameIn', 'HostyMcHost'); h.click('#hostBtn'); time.sleep(1)
        code = h.evaluate('NET.code'); print('room', code)
        g.goto(URL); g.fill('#nameIn', 'GuestGuy'); g.fill('#codeIn', code); g.click('#joinBtn'); time.sleep(1.5)
        g.screenshot(path=f'{OUT}/o1_guest_lobby.png'); h.screenshot(path=f'{OUT}/o0_host_lobby.png')
        h.click('#startBtn')
        wait_phase(g, 'live', 15); time.sleep(2)
        g.keyboard.press('b'); time.sleep(0.8)
        gid = g.evaluate('myId')
        hp = h.evaluate(f"G.players.find(p => p.id === {gid!r})")
        print('host sees guest coins after buy:', hp['coins'] > 0, 'trades', hp['trades'])
        g.evaluate("document.querySelector('#chatIn').value='gm degens'; document.querySelector('#chatForm').requestSubmit()")
        time.sleep(1.2)
        print('guest chat reached host:', any(c[2] == 'gm degens' for c in h.evaluate('G.chat')))
        print('tick host/guest:', h.evaluate('G.R.k'), g.evaluate('curK()'))
        g.screenshot(path=f'{OUT}/o2_guest_live.png')
        g.keyboard.press('s'); time.sleep(0.8)
        hp = h.evaluate(f"G.players.find(p => p.id === {gid!r})")
        print('host sees guest sold:', hp['coins'] == 0, 'cash', round(hp['cash'], 2))
        h.close(); time.sleep(10.5)
        print('guest view after host left:', g.evaluate('UI.view'), '| toast:', g.evaluate("document.querySelector('#toast').textContent"))
    b.close()
print('errors:', errors or 'none')
