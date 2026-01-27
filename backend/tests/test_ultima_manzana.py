"""
Test cases for GET /api/predios/ultima-manzana/{municipio} endpoint
Tests the functionality to get the last registered 'manzana' (block) for a specific sector.

Feature: When user selects a zone and sector in 'Crear Predio' form, 
the system shows an informative message indicating the last registered manzana.
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
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def api_client(auth_token):
    """Shared requests session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestUltimaManzanaEndpoint:
    """Tests for GET /api/predios/ultima-manzana/{municipio} endpoint"""
    
    def test_ultima_manzana_el_carmen_zona01_sector01(self, api_client):
        """
        Test: Get ultima manzana for El Carmen, zona 01, sector 01
        Expected: Returns ultima_manzana: 3026 (as per main agent context)
        """
        response = api_client.get(
            f"{BASE_URL}/api/predios/ultima-manzana/El Carmen",
            params={"zona": "01", "sector": "01"}
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "municipio" in data, "Response should contain 'municipio'"
        assert "zona" in data, "Response should contain 'zona'"
        assert "sector" in data, "Response should contain 'sector'"
        assert "ultima_manzana" in data, "Response should contain 'ultima_manzana'"
        assert "total_manzanas" in data, "Response should contain 'total_manzanas'"
        assert "total_predios_sector" in data, "Response should contain 'total_predios_sector'"
        assert "mensaje" in data, "Response should contain 'mensaje'"
        
        # Verify values
        assert data["municipio"] == "El Carmen"
        assert data["zona"] == "01"
        assert data["sector"] == "01"
        
        # Verify ultima_manzana is not None (sector has data)
        assert data["ultima_manzana"] is not None, "El Carmen zona 01, sector 01 should have data"
        
        # Verify ultima_manzana is a 4-digit string
        assert len(data["ultima_manzana"]) == 4, "ultima_manzana should be 4 digits"
        assert data["ultima_manzana"].isdigit(), "ultima_manzana should be numeric"
        
        # Verify totals are positive
        assert data["total_manzanas"] > 0, "total_manzanas should be > 0"
        assert data["total_predios_sector"] > 0, "total_predios_sector should be > 0"
        
        print(f"✓ El Carmen zona 01, sector 01: ultima_manzana={data['ultima_manzana']}, "
              f"total_manzanas={data['total_manzanas']}, total_predios={data['total_predios_sector']}")
    
    
    def test_ultima_manzana_empty_sector(self, api_client):
        """
        Test: Get ultima manzana for a sector with no data
        Expected: Returns ultima_manzana: null
        """
        # Use a sector that likely has no data (sector 99)
        response = api_client.get(
            f"{BASE_URL}/api/predios/ultima-manzana/El Carmen",
            params={"zona": "01", "sector": "99"}
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "municipio" in data
        assert "zona" in data
        assert "sector" in data
        assert "ultima_manzana" in data
        
        # For empty sector, ultima_manzana should be None
        assert data["ultima_manzana"] is None, "Empty sector should return ultima_manzana: null"
        assert data["total_predios_sector"] == 0, "Empty sector should have 0 predios"
        
        print(f"✓ Empty sector test passed: ultima_manzana=null, total_predios=0")
    
    
    def test_ultima_manzana_abrego(self, api_client):
        """
        Test: Get ultima manzana for Ábrego municipality
        Expected: Returns valid response (may or may not have data)
        """
        response = api_client.get(
            f"{BASE_URL}/api/predios/ultima-manzana/Ábrego",
            params={"zona": "00", "sector": "01"}
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert data["municipio"] == "Ábrego"
        assert data["zona"] == "00"
        assert data["sector"] == "01"
        assert "ultima_manzana" in data
        assert "mensaje" in data
        
        print(f"✓ Ábrego zona 00, sector 01: ultima_manzana={data['ultima_manzana']}, "
              f"total_predios={data['total_predios_sector']}")
    
    
    def test_ultima_manzana_bucarasica(self, api_client):
        """
        Test: Get ultima manzana for Bucarasica municipality
        Expected: Returns valid response
        """
        response = api_client.get(
            f"{BASE_URL}/api/predios/ultima-manzana/Bucarasica",
            params={"zona": "00", "sector": "01"}
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert data["municipio"] == "Bucarasica"
        assert "ultima_manzana" in data
        
        print(f"✓ Bucarasica zona 00, sector 01: ultima_manzana={data['ultima_manzana']}, "
              f"total_predios={data['total_predios_sector']}")
    
    
    def test_ultima_manzana_invalid_municipio(self, api_client):
        """
        Test: Get ultima manzana for non-existent municipality
        Expected: Returns 404 error
        """
        response = api_client.get(
            f"{BASE_URL}/api/predios/ultima-manzana/MunicipioInexistente",
            params={"zona": "01", "sector": "01"}
        )
        
        # Status code assertion - should be 404
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        
        # Verify error message
        data = response.json()
        assert "detail" in data
        assert "no encontrado" in data["detail"].lower() or "not found" in data["detail"].lower()
        
        print(f"✓ Invalid municipio returns 404 as expected")
    
    
    def test_ultima_manzana_default_params(self, api_client):
        """
        Test: Get ultima manzana with default parameters (zona=00, sector=00)
        Expected: Returns valid response
        """
        response = api_client.get(
            f"{BASE_URL}/api/predios/ultima-manzana/El Carmen"
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions - should use default values
        data = response.json()
        assert data["zona"] == "00", "Default zona should be '00'"
        assert data["sector"] == "00", "Default sector should be '00'"
        
        print(f"✓ Default params test: zona={data['zona']}, sector={data['sector']}")
    
    
    def test_ultima_manzana_rural_zone(self, api_client):
        """
        Test: Get ultima manzana for rural zone (zona=00)
        Expected: Returns valid response for rural area
        """
        response = api_client.get(
            f"{BASE_URL}/api/predios/ultima-manzana/El Carmen",
            params={"zona": "00", "sector": "01"}
        )
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert data["zona"] == "00", "Rural zone should be '00'"
        
        print(f"✓ Rural zone (00) test: ultima_manzana={data['ultima_manzana']}, "
              f"total_predios={data['total_predios_sector']}")
    
    
    def test_ultima_manzana_response_structure(self, api_client):
        """
        Test: Verify complete response structure
        Expected: All required fields present with correct types
        """
        response = api_client.get(
            f"{BASE_URL}/api/predios/ultima-manzana/El Carmen",
            params={"zona": "01", "sector": "01"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields
        required_fields = ["municipio", "zona", "sector", "ultima_manzana", 
                          "total_manzanas", "total_predios_sector", "mensaje"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify types
        assert isinstance(data["municipio"], str)
        assert isinstance(data["zona"], str)
        assert isinstance(data["sector"], str)
        assert data["ultima_manzana"] is None or isinstance(data["ultima_manzana"], str)
        assert isinstance(data["total_manzanas"], int) or data["total_manzanas"] is None
        assert isinstance(data["total_predios_sector"], int)
        assert isinstance(data["mensaje"], str)
        
        print(f"✓ Response structure validation passed")


class TestUltimaManzanaAuth:
    """Tests for authentication requirements"""
    
    def test_ultima_manzana_without_auth(self):
        """
        Test: Access endpoint without authentication
        Expected: Returns 401/403 error
        """
        response = requests.get(
            f"{BASE_URL}/api/predios/ultima-manzana/El Carmen",
            params={"zona": "01", "sector": "01"}
        )
        
        # Should require authentication
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"
        
        print(f"✓ Endpoint requires authentication (returns {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
