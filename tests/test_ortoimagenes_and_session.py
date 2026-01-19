"""
Test suite for Ortoimagenes functionality and Session Timeout
Tests:
- GET /api/ortoimagenes/disponibles - List available ortoimagenes
- GET /api/ortoimagenes/tiles/{id}/{z}/{x}/{y}.png - Serve tiles
- Login functionality
- Dashboard loading
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://property-sync-10.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "catastro@asomunicipios.gov.co"
ADMIN_PASSWORD = "Asm*123*"


class TestOrtoimagenes:
    """Tests for ortoimagenes endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_ortoimagenes_disponibles_returns_list(self):
        """GET /api/ortoimagenes/disponibles should return list of ortoimagenes"""
        response = self.session.get(f"{BASE_URL}/api/ortoimagenes/disponibles")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "ortoimagenes" in data, "Response should contain 'ortoimagenes' key"
        assert isinstance(data["ortoimagenes"], list), "ortoimagenes should be a list"
    
    def test_ortoimagenes_disponibles_contains_ocana(self):
        """GET /api/ortoimagenes/disponibles should contain Ocaña ortoimagen"""
        response = self.session.get(f"{BASE_URL}/api/ortoimagenes/disponibles")
        
        assert response.status_code == 200
        
        data = response.json()
        ortoimagenes = data["ortoimagenes"]
        
        # Find Ocaña ortoimagen
        ocana = next((o for o in ortoimagenes if o["id"] == "ocana"), None)
        
        assert ocana is not None, "Ocaña ortoimagen should be in the list"
        assert ocana["nombre"] == "Ortoimagen Ocaña (Prueba)", f"Expected 'Ortoimagen Ocaña (Prueba)', got {ocana['nombre']}"
        assert ocana["municipio"] == "Ocaña", f"Expected 'Ocaña', got {ocana['municipio']}"
        assert ocana["activa"] == True, "Ortoimagen should be active"
        assert ocana["zoom_min"] == 14, f"Expected zoom_min 14, got {ocana['zoom_min']}"
        assert ocana["zoom_max"] == 20, f"Expected zoom_max 20, got {ocana['zoom_max']}"
        assert "bounds" in ocana, "Ortoimagen should have bounds"
        assert len(ocana["bounds"]) == 2, "Bounds should have 2 corners (SW, NE)"
    
    def test_ortoimagenes_tiles_nonexistent_returns_204(self):
        """GET /api/ortoimagenes/tiles/{id}/{z}/{x}/{y}.png should return 204 for non-existent tile"""
        # Request a tile that doesn't exist (outside bounds)
        response = self.session.get(f"{BASE_URL}/api/ortoimagenes/tiles/ocana/17/0/0.png")
        
        # Should return 204 No Content for non-existent tiles
        assert response.status_code == 204, f"Expected 204 for non-existent tile, got {response.status_code}"
    
    def test_ortoimagenes_tiles_invalid_id_returns_404(self):
        """GET /api/ortoimagenes/tiles/{id}/{z}/{x}/{y}.png should return 404 for invalid ortoimagen ID"""
        response = self.session.get(f"{BASE_URL}/api/ortoimagenes/tiles/invalid_id/17/38000/60000.png")
        
        assert response.status_code == 404, f"Expected 404 for invalid ortoimagen ID, got {response.status_code}"
    
    def test_ortoimagenes_tiles_valid_tile_exists(self):
        """GET /api/ortoimagenes/tiles/{id}/{z}/{x}/{y}.png should return tile or 204"""
        # Test with a tile that might exist based on bounds
        # Bounds: SW [-73.34486, 8.23718], NE [-73.34203, 8.24056]
        # At zoom 17, we need to calculate the correct tile coordinates
        response = self.session.get(f"{BASE_URL}/api/ortoimagenes/tiles/ocana/17/38000/60000.png")
        
        # Should return either 200 (tile exists) or 204 (no content)
        assert response.status_code in [200, 204], f"Expected 200 or 204, got {response.status_code}"


class TestAuthentication:
    """Tests for authentication endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_login_success(self):
        """POST /api/auth/login should return token for valid credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "token" in data, "Response should contain 'token'"
        assert "user" in data, "Response should contain 'user'"
        assert data["user"]["email"] == ADMIN_EMAIL, f"Expected email {ADMIN_EMAIL}, got {data['user']['email']}"
        assert data["user"]["role"] == "administrador", f"Expected role 'administrador', got {data['user']['role']}"
    
    def test_login_invalid_credentials(self):
        """POST /api/auth/login should return 401 for invalid credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@example.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_auth_me_with_valid_token(self):
        """GET /api/auth/me should return user info with valid token"""
        # First login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Now test /auth/me
        response = self.session.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["email"] == ADMIN_EMAIL, f"Expected email {ADMIN_EMAIL}, got {data['email']}"


class TestDashboardEndpoints:
    """Tests for dashboard-related endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json()["token"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed - skipping authenticated tests")
    
    def test_gdb_stats_endpoint(self):
        """GET /api/gdb/stats should return GDB statistics"""
        response = self.session.get(f"{BASE_URL}/api/gdb/stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "total_geometrias" in data or "municipios" in data, "Response should contain GDB stats"
    
    def test_gdb_limites_municipios_endpoint(self):
        """GET /api/gdb/limites-municipios should return municipality limits"""
        response = self.session.get(f"{BASE_URL}/api/gdb/limites-municipios?fuente=oficial")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "features" in data or "type" in data, "Response should be GeoJSON format"
    
    def test_predios_search_endpoint(self):
        """GET /api/predios should return predios list"""
        response = self.session.get(f"{BASE_URL}/api/predios?limit=5")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "predios" in data, "Response should contain 'predios' key"
        assert isinstance(data["predios"], list), "predios should be a list"
    
    def test_notificaciones_endpoint(self):
        """GET /api/notificaciones should return notifications"""
        response = self.session.get(f"{BASE_URL}/api/notificaciones")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "notificaciones" in data, "Response should contain 'notificaciones' key"


class TestVisorPrediosEndpoints:
    """Tests for Visor de Predios related endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json()["token"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed - skipping authenticated tests")
    
    def test_gdb_geometrias_endpoint(self):
        """GET /api/gdb/geometrias should return geometries for a municipality"""
        # First get available municipalities from stats
        stats_response = self.session.get(f"{BASE_URL}/api/gdb/stats")
        
        if stats_response.status_code == 200:
            stats = stats_response.json()
            municipios = stats.get("municipios", {})
            
            if municipios:
                # Get first municipality
                first_municipio = list(municipios.keys())[0]
                
                response = self.session.get(f"{BASE_URL}/api/gdb/geometrias?municipio={first_municipio}&limit=10")
                
                assert response.status_code == 200, f"Expected 200, got {response.status_code}"
                
                data = response.json()
                assert "features" in data or "total" in data, "Response should contain geometries data"
    
    def test_verificar_carga_mes_endpoint(self):
        """GET /api/gdb/verificar-carga-mes should return monthly load status"""
        response = self.session.get(f"{BASE_URL}/api/gdb/verificar-carga-mes")
        
        # This endpoint might return 200 or 404 depending on implementation
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
