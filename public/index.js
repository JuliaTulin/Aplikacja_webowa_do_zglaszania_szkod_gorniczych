var map = L.map('map');
        var marker;
        var userLat, userLng;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        var center = [50.0804724, 19.1614253]; // Współrzędne centrum
        var bufferRadius = 11 * 1000;
        var bounds = L.latLng(center).toBounds(bufferRadius);
        map.fitBounds(bounds);

        // Funkcja do pobierania lokalizacji użytkownika
        function getUserLocation() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function(position) {
                    userLat = position.coords.latitude;
                    userLng = position.coords.longitude;

                    // Ustawienie współrzędnych w formularzu
                    document.getElementById('latitude').value = userLat;
                    document.getElementById('longitude').value = userLng;

                    // Ustawienie mapy na lokalizację użytkownika
                    map.setView([userLat, userLng], 13);

                    // Dodanie markera w lokalizacji użytkownika
                    if (marker) {
                        map.removeLayer(marker);
                    }
                    marker = L.marker([userLat, userLng]).addTo(map);

                }, function(error) {
                    alert('Nie udało się pobrać lokalizacji. Wykorzystuję domyślną lokalizację.');
                    map.setView(center, 13); // W przypadku błędu, ustawienie domyślnej lokalizacji
                });
            } else {
                alert('Geolokalizacja nie jest wspierana w tej przeglądarce.');
                map.setView(center, 13); // W przypadku braku geolokalizacji
            }
        }

        // Funkcja powrotu do lokalizacji użytkownika
        function returnToUserLocation() {
            if (userLat && userLng) {
                map.setView([userLat, userLng], 13);
                if (marker) {
                    map.removeLayer(marker);
                }
                marker = L.marker([userLat, userLng]).addTo(map);
            } else {
                alert('Nie udało się pobrać Twojej lokalizacji. Używam domyślnej lokalizacji.');
                map.setView(center, 13); // Powrót do domyślnej lokalizacji
            }
        }

        // Dodanie funkcji kliknięcia na mapie
        map.on('click', function(e) {
            var lat = e.latlng.lat;
            var lng = e.latlng.lng;

            // Sprawdź, czy marker już istnieje, i usuń go, jeśli tak
            if (marker) {
                map.removeLayer(marker);
            }

            // Utwórz nowy marker na mapie
            marker = L.marker([lat, lng]).addTo(map);

            // Wstaw współrzędne do widocznych pól formularza
            document.getElementById('latitude').value = lat;
            document.getElementById('longitude').value = lng;
        });

        // Funkcja do obsługi wysyłania formularza
        async function submitForm() {
            const firstName = document.getElementById('first-name').value;
            const lastName = document.getElementById('last-name').value;
            const email = document.getElementById('email').value;
            const note = document.getElementById('note').value;
            const latitude = document.getElementById('latitude').value;
            const longitude = document.getElementById('longitude').value;

            if (!firstName || !lastName || !email || !note || !latitude || !longitude) {
                alert('Proszę wypełnić wszystkie pola formularza!');
                return; // Przerywamy dalsze działanie, jeśli jakieś pole jest puste
            }

            const data = {
                imie: firstName,
                nazwisko: lastName,
                email: email,
                opis: note,        
                latitude: parseFloat(latitude),       
                longitude: parseFloat(longitude)
            };

            try {
                const response = await fetch('/api/points', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (response.ok) {
                    alert('Punkt został zapisany!');
                    document.getElementById('pointForm').reset();
                    if (marker) map.removeLayer(marker); // Usuń marker po zapisaniu
                } else {
                    const errorData = await response.json();
                    alert('Błąd podczas zapisu punktu: ' + errorData.message);
                }
            } catch (error) {
                alert('Wystąpił problem podczas zapisu punktu: ' + error);
            }
        }

        // Funkcja, która ładuje plik GeoJSON i dodaje go jako warstwę na mapie
        async function loadGeoJsonLayer() {
            try {
                const response = await fetch('kopalnia/kopalnia_wszystkie.geojson');
                if (!response.ok) throw new Error(`Błąd HTTP: ${response.status}`);
                const geojsonData = await response.json();

                // Dodaj warstwę GeoJSON do mapy
                const geoJsonLayer = L.geoJSON(geojsonData).addTo(map);
                map.fitBounds(geoJsonLayer.getBounds());
            } catch (error) {
                console.error("Błąd podczas wczytywania pliku GeoJSON:", error);
                alert('Nie udało się wczytać pliku GeoJSON.');
            }
        }

        // Wywołaj funkcję ładującą po zainicjowaniu mapy
        loadGeoJsonLayer();

        // Pobierz lokalizację użytkownika na początku
        getUserLocation();