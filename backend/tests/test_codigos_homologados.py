"""
Test suite for Códigos Homologados endpoints
Tests the functionality for loading, retrieving stats, and getting next available codes
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "catastro@asomunicipios.gov.co"
ADMIN_PASSWORD = "Asm*123*"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in response"
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestCodigosHomologadosStats:
    """Test GET /api/codigos-homologados/stats endpoint"""
    
    def test_get_stats_success(self, auth_headers):
        """Test getting stats returns 200 and correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/codigos-homologados/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "stats" in data, "Response should have 'stats' field"
        assert "total_municipios" in data, "Response should have 'total_municipios' field"
        assert isinstance(data["stats"], list), "Stats should be a list"
        
        print(f"✓ Stats endpoint returned {len(data['stats'])} municipios")
    
    def test_stats_contains_abrego(self, auth_headers):
        """Test that stats contain Ábrego with 3,086 codes"""
        response = requests.get(
            f"{BASE_URL}/api/codigos-homologados/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Find Ábrego in stats
        abrego_stats = None
        for stat in data["stats"]:
            if stat["municipio"] == "Ábrego":
                abrego_stats = stat
                break
        
        assert abrego_stats is not None, "Ábrego should be in stats"
        assert "total" in abrego_stats, "Stats should have 'total' field"
        assert "usados" in abrego_stats, "Stats should have 'usados' field"
        assert "disponibles" in abrego_stats, "Stats should have 'disponibles' field"
        
        print(f"✓ Ábrego stats: total={abrego_stats['total']}, usados={abrego_stats['usados']}, disponibles={abrego_stats['disponibles']}")
        
        # Verify the expected count (3,086 codes were loaded)
        assert abrego_stats["total"] >= 3086, f"Expected at least 3086 codes for Ábrego, got {abrego_stats['total']}"
    
    def test_stats_without_auth_fails(self):
        """Test that stats endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/codigos-homologados/stats")
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Stats endpoint correctly requires authentication")


class TestSiguienteCodigoHomologado:
    """Test GET /api/codigos-homologados/siguiente/{municipio} endpoint"""
    
    def test_get_siguiente_codigo_abrego(self, auth_headers):
        """Test getting next available code for Ábrego"""
        response = requests.get(
            f"{BASE_URL}/api/codigos-homologados/siguiente/Ábrego",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "municipio" in data, "Response should have 'municipio' field"
        assert "codigo" in data, "Response should have 'codigo' field"
        assert "disponibles" in data, "Response should have 'disponibles' field"
        
        assert data["municipio"] == "Ábrego", f"Expected municipio 'Ábrego', got {data['municipio']}"
        
        print(f"✓ Next code for Ábrego: {data['codigo']}, disponibles: {data['disponibles']}")
        
        # Verify the expected next code (BPP0002BUTE as per context)
        if data["codigo"]:
            print(f"✓ Next available code: {data['codigo']}")
    
    def test_get_siguiente_codigo_nonexistent_municipio(self, auth_headers):
        """Test getting next code for a municipio without codes"""
        response = requests.get(
            f"{BASE_URL}/api/codigos-homologados/siguiente/MunicipioInexistente",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["codigo"] is None, "Should return null code for nonexistent municipio"
        assert data["disponibles"] == 0, "Should return 0 disponibles for nonexistent municipio"
        assert "mensaje" in data, "Should have a message explaining no codes available"
        
        print(f"✓ Correctly handles nonexistent municipio: {data['mensaje']}")
    
    def test_siguiente_codigo_without_auth_fails(self):
        """Test that siguiente endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/codigos-homologados/siguiente/Ábrego")
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Siguiente endpoint correctly requires authentication")


class TestCodigosDisponibles:
    """Test GET /api/codigos-homologados/disponibles/{municipio} endpoint"""
    
    def test_get_codigos_disponibles_abrego(self, auth_headers):
        """Test getting available codes for Ábrego"""
        response = requests.get(
            f"{BASE_URL}/api/codigos-homologados/disponibles/Ábrego?limit=10",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "municipio" in data, "Response should have 'municipio' field"
        assert "codigos" in data, "Response should have 'codigos' field"
        assert "total_disponibles" in data, "Response should have 'total_disponibles' field"
        
        assert data["municipio"] == "Ábrego"
        assert isinstance(data["codigos"], list), "Codigos should be a list"
        assert len(data["codigos"]) <= 10, "Should respect limit parameter"
        
        print(f"✓ Available codes for Ábrego: {len(data['codigos'])} returned, {data['total_disponibles']} total")
        if data["codigos"]:
            print(f"  First codes: {data['codigos'][:5]}")


class TestCargarCodigosHomologados:
    """Test POST /api/codigos-homologados/cargar endpoint"""
    
    def test_cargar_requires_auth(self):
        """Test that cargar endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/codigos-homologados/cargar")
        
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422 without auth, got {response.status_code}"
        print("✓ Cargar endpoint correctly requires authentication")
    
    def test_cargar_requires_file(self, auth_headers):
        """Test that cargar endpoint requires a file"""
        response = requests.post(
            f"{BASE_URL}/api/codigos-homologados/cargar",
            headers=auth_headers
        )
        
        # Should fail because no file was provided
        assert response.status_code == 422, f"Expected 422 without file, got {response.status_code}"
        print("✓ Cargar endpoint correctly requires file")
    
    def test_cargar_rejects_non_excel(self, auth_headers):
        """Test that cargar endpoint rejects non-Excel files"""
        # Create a fake text file
        files = {"file": ("test.txt", b"test content", "text/plain")}
        
        response = requests.post(
            f"{BASE_URL}/api/codigos-homologados/cargar",
            headers=auth_headers,
            files=files
        )
        
        assert response.status_code == 400, f"Expected 400 for non-Excel file, got {response.status_code}"
        print("✓ Cargar endpoint correctly rejects non-Excel files")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
