from pyproj import Transformer

# Układ współrzędnych wejściowy i docelowy
proj_from = "EPSG:32634"  # UTM 34N
proj_to = "EPSG:4326"  # WGS84 (stopnie)

# Lista współrzędnych w UTM (X, Y)
coordinates = [
    (32360, 22170),  # Usuwamy ujemny znak dla testu
    (33878, 19987),
    (33272, 23082),
    (29253, 22119),
    (30472, 22091),
    (30760, 20504),
    (31485, 24626),
    (33077, 24668),
    (31724, 18059),
    (31020, 23737),
    (31200, 16104),
    (34324, 21813),
    (28652, 24415),
    (34744, 25858),
    (28645, 18000),
]

# Transformacja współrzędnych
transformer = Transformer.from_crs(proj_from, proj_to, always_xy=True)
for x, y in coordinates:
    lon, lat = transformer.transform(x, y)
    print(f"Długość geograficzna: {lon:.6f}, Szerokość geograficzna: {lat:.6f}")
