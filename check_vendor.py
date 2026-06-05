import json, urllib.request

d = json.loads(urllib.request.urlopen("http://localhost:8001/api/kpi/vendor").read())
for x in d["kpis"]:
    print(f"{x['kpi_code']:30s} = {str(x['value_numeric']):>15s} {x['unit'] or ''}")

c = json.loads(urllib.request.urlopen("http://localhost:8001/api/charts/vendor").read())
s = c["series"]
print(f"\nChart type: {s.get('type','N/A')}")
for k, v in s.items():
    if isinstance(v, list):
        print(f"  {k}: {len(v)} items")
    else:
        print(f"  {k}: {type(v).__name__}")
