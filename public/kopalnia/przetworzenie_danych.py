import pandas as pd

# Wczytaj plik Excel
file_path = 'public\kopalnia\wstrzasy.xlsx'
data = pd.read_excel(file_path)

# Wyświetl pierwsze kilka wierszy, aby sprawdzić strukturę danych
print(data.head())
print(data.info())

# Przetworzenie danych
# Usuń wiersze z brakującymi współrzędnymi X lub Y
data_cleaned = data.dropna(subset=['X', 'Y'])

# Połącz kolumny DATA i CZAS w datetime
data_cleaned.loc[:, 'DATETIME'] = pd.to_datetime(
    data_cleaned['DATA'] + ' ' + data_cleaned['CZAS'],
    errors='coerce'
)

# Konwersja ENERGIA do formatu numerycznego (zamiana przecinka na kropkę i konwersja do float)
data_cleaned.loc[:, 'ENERGIA'] = pd.to_numeric(
    data_cleaned['ENERGIA'].str.replace(',', '.'),
    errors='coerce'
)

# Wybierz tylko niezbędne kolumny
data_ready = data_cleaned[['DATETIME', 'X', 'Y', 'ENERGIA']].dropna()

# Eksport pierwszych kilku wierszy do JSON w celu podglądu
data_ready_preview = data_ready.head(10).to_dict(orient='records')
#print(data_ready_preview)


# Eksport danych do pliku JSON
output_path = 'wstrzasy1.json'
data_ready.to_json(output_path, orient='records', date_format='iso', indent=4)

print(f"Dane zostały zapisane do pliku {output_path}")
