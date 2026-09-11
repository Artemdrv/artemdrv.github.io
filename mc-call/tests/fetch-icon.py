"""Build-time only: obtain the published Apple Phone artwork from Apple's own metadata.
No browser runtime request and no user contact data involved. Falls back explicitly.
"""
from pathlib import Path
from urllib.request import urlopen,Request
from urllib.parse import urlparse
from PIL import Image
import json,re,html,hashlib,io
P=Path(__file__).resolve().parents[1]
def get(url):
 return urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read()
source=None
try:
 result=json.loads(get('https://itunes.apple.com/lookup?id=1146562108&country=us'))
 app=next(x for x in result.get('results',[]) if x.get('trackId')==1146562108)
 source=app.get('artworkUrl512') or app.get('artworkUrl100')
except Exception:
 try:
  page=get('https://apps.apple.com/us/app/phone/id1146562108').decode()
  candidates=re.findall(r'https://is\d-ssl\.mzstatic\.com/image/thumb/[^"<>\s]+',page.replace('\\/','/'))
  source=html.unescape(candidates[0]) if candidates else None
 except Exception:pass
try:
 if not source:raise RuntimeError('No official artwork URL returned')
 source=re.sub(r'/\d+x\d+[^/]*$','/512x512bb.png',source)
 if not urlparse(source).hostname.endswith('.mzstatic.com'):raise ValueError('Artwork host must be Apple CDN')
 data=get(source);image=Image.open(io.BytesIO(data)).convert('RGBA')
 if image.width!=image.height or image.width<180:raise ValueError('Artwork is not a square icon')
 for size in [180,192,512]:image.resize((size,size),Image.Resampling.LANCZOS).save(P/f'assets/icon-r4-{size}.png',optimize=True)
 metadata={'status':'official-apple-artwork','page':'https://apps.apple.com/us/app/phone/id1146562108','url':source,'sha256':hashlib.sha256(data).hexdigest()}
except Exception as e:
 metadata={'status':'reference-reconstruction','reason':str(e),'page':'https://apps.apple.com/us/app/phone/id1146562108'}
(P/'assets/icon-source.json').write_text(json.dumps(metadata,indent=2))
(P/'qa').mkdir(exist_ok=True)
Image.open(P/'assets/icon-r4-512.png').save(P/'qa/icon-preview.png')
(P/'qa/icon-source.json').write_text(json.dumps(metadata,indent=2))
print(json.dumps(metadata))
