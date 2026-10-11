import json
from pyproj import Proj, transform

# Definicja układów współrzędnych
source_proj = Proj(proj="tmerc", lat_0=0, lon_0=19, k=0.999923, x_0=0, y_0=0, ellps="GRS80", units="m", no_defs=True)
target_proj = Proj(proj="longlat", ellps="WGS84", datum="WGS84", no_defs=True)

# Wczytaj plik JSON
input_file = "public\kopalnia\wstrzasy1.json"
output_file = "public\kopalnia\wstrzasy_converted.json"

with open(input_file, "r", encoding="utf-8") as file:
    data = json.load(file)

# Konwersja współrzędnych
for event in data:
    x, y = event["X"], event["Y"]
    lon, lat = transform(source_proj, target_proj, x, y)
    event["longitude"] = lon
    event["latitude"] = lat
    # Usuń oryginalne współrzędne (opcjonalnie)
    del event["X"]
    del event["Y"]

# Zapisz zmieniony plik
with open(output_file, "w", encoding="utf-8") as file:
    json.dump(data, file, indent=4, ensure_ascii=False)

print(f"Zapisano skonwertowane dane w pliku {output_file}")
