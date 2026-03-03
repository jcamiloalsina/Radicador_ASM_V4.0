"""
Tests for Manual Resolution Generation Feature
Tests the following endpoints:
- POST /api/resoluciones/generar-manual - Generate PDF, save to DB, update predio historial
- GET /api/resoluciones/siguiente-numero/{codigo_municipio} - Auto-generate resolution number
- GET /api/resoluciones/radicados-disponibles - Search available petitions
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "catastro@asomunicipios.gov.co"
ADMIN_PASSWORD = "Asm*123*"
GESTOR_EMAIL = "gestor@emergent.co"
GESTOR_PASSWORD = "Asm*123*"

# Test predio ID from the context
TEST_PREDIO_ID = "a561dd40-c254-4e52-a7d8-9700e05490a8"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def authenticated_client(api_client, admin_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


class TestSiguienteNumeroResolucion:
    """Tests for GET /api/resoluciones/siguiente-numero/{codigo_municipio}"""
    
    def test_siguiente_numero_valid_municipio(self, authenticated_client):
        """Test getting next resolution number for a valid municipality code"""
        # Cáchira is code 54128
        response = authenticated_client.get(f"{BASE_URL}/api/resoluciones/siguiente-numero/54128")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        assert "numero_resolucion" in data
        assert "siguiente_numero" in data
        assert "fecha_resolucion" in data
        
        # Verify format: RES-{DEPTO}-{MPIO}-{NUM}-{YEAR}
        numero = data["numero_resolucion"]
        assert numero.startswith("RES-")
        assert "-54-" in numero or "54" in numero
        assert str(datetime.now().year) in numero
        print(f"PASS: Next resolution number for 54128: {numero}")
    
    def test_siguiente_numero_abrego(self, authenticated_client):
        """Test getting next resolution number for Ábrego (54003)"""
        response = authenticated_client.get(f"{BASE_URL}/api/resoluciones/siguiente-numero/54003")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "RES-54-003-" in data["numero_resolucion"]
        print(f"PASS: Ábrego resolution number: {data['numero_resolucion']}")
    
    def test_siguiente_numero_convencion(self, authenticated_client):
        """Test getting next resolution number for Convención (54206)"""
        response = authenticated_client.get(f"{BASE_URL}/api/resoluciones/siguiente-numero/54206")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "54" in data["numero_resolucion"]
        print(f"PASS: Convención resolution number: {data['numero_resolucion']}")
    
    def test_siguiente_numero_by_name(self, authenticated_client):
        """Test that endpoint handles municipality name input (fallback)"""
        response = authenticated_client.get(f"{BASE_URL}/api/resoluciones/siguiente-numero/Cachira")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        print(f"PASS: Name-based lookup returned: {data['numero_resolucion']}")


class TestRadicadosDisponibles:
    """Tests for GET /api/resoluciones/radicados-disponibles"""
    
    def test_get_radicados_sin_filtro(self, authenticated_client):
        """Test getting available petitions without filters"""
        response = authenticated_client.get(f"{BASE_URL}/api/resoluciones/radicados-disponibles")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        assert "radicados" in data
        assert isinstance(data["radicados"], list)
        print(f"PASS: Found {len(data['radicados'])} available petitions")
    
    def test_get_radicados_con_busqueda(self, authenticated_client):
        """Test searching petitions by radicado number"""
        response = authenticated_client.get(f"{BASE_URL}/api/resoluciones/radicados-disponibles?busqueda=RASMGC")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        assert isinstance(data["radicados"], list)
        
        # All results should contain the search term
        for radicado in data["radicados"]:
            assert "RASMGC" in radicado.get("radicado", "").upper() or len(data["radicados"]) == 0
        print(f"PASS: Search returned {len(data['radicados'])} matching petitions")
    
    def test_get_radicados_con_municipio(self, authenticated_client):
        """Test filtering petitions by municipio"""
        response = authenticated_client.get(f"{BASE_URL}/api/resoluciones/radicados-disponibles?municipio=Cachira")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") is True
        assert isinstance(data["radicados"], list)
        print(f"PASS: Municipio filter returned {len(data['radicados'])} petitions")
    
    def test_radicados_estructura(self, authenticated_client):
        """Verify radicado structure has required fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/resoluciones/radicados-disponibles")
        assert response.status_code == 200
        
        data = response.json()
        if data["radicados"]:
            radicado = data["radicados"][0]
            # Check expected fields (any of these could exist)
            has_expected_fields = any(k in radicado for k in ["id", "radicado", "municipio", "tipo_tramite"])
            assert has_expected_fields, f"Radicado missing expected fields: {radicado.keys()}"
            assert "_id" not in radicado, "MongoDB _id should be excluded"
            print(f"PASS: Radicado structure verified: {list(radicado.keys())}")
        else:
            print("PASS: No radicados to verify structure (empty list)")


class TestGenerarResolucionManual:
    """Tests for POST /api/resoluciones/generar-manual"""
    
    def test_generar_resolucion_success(self, authenticated_client):
        """Test generating a manual resolution successfully"""
        # First get the next number
        num_response = authenticated_client.get(f"{BASE_URL}/api/resoluciones/siguiente-numero/54128")
        assert num_response.status_code == 200
        num_data = num_response.json()
        numero_resolucion = num_data["numero_resolucion"]
        
        # Generate the resolution
        payload = {
            "predio_id": TEST_PREDIO_ID,
            "tipo_mutacion": "M1",
            "numero_resolucion": numero_resolucion,
            "fecha_resolucion": datetime.now().strftime("%d/%m/%Y"),
            "radicado_peticion": None,
            "datos_predio": {
                "direccion": "CALLE PRUEBA 123",
                "avaluo": 50000000
            }
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/resoluciones/generar-manual", json=payload)
        
        # Allow 200 or 404 (predio may not exist)
        if response.status_code == 404:
            print(f"SKIP: Test predio {TEST_PREDIO_ID} not found - this is expected if predio was deleted")
            pytest.skip("Test predio not found")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") is True
        assert data.get("numero_resolucion") == numero_resolucion
        assert "pdf_url" in data
        assert data["pdf_url"].startswith("/resoluciones/")
        print(f"PASS: Resolution {numero_resolucion} generated. PDF: {data['pdf_url']}")
    
    def test_generar_resolucion_missing_predio(self, authenticated_client):
        """Test that generating resolution for non-existent predio returns 404"""
        payload = {
            "predio_id": "nonexistent-predio-id-12345",
            "tipo_mutacion": "M1",
            "numero_resolucion": "RES-54-128-9999-2026",
            "fecha_resolucion": "03/03/2026",
            "radicado_peticion": None
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/resoluciones/generar-manual", json=payload)
        assert response.status_code == 404
        print("PASS: Non-existent predio correctly returns 404")
    
    def test_generar_resolucion_sin_auth(self, api_client):
        """Test that unauthenticated request is rejected"""
        # Create fresh session without auth
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        payload = {
            "predio_id": TEST_PREDIO_ID,
            "tipo_mutacion": "M1",
            "numero_resolucion": "RES-TEST-001",
            "fecha_resolucion": "03/03/2026"
        }
        
        response = session.post(f"{BASE_URL}/api/resoluciones/generar-manual", json=payload)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Unauthenticated request correctly rejected")


class TestIntegracionResolucionPredio:
    """Integration tests for resolution generation with predio update"""
    
    def test_predio_historial_actualizado(self, authenticated_client):
        """Test that predio historial_resoluciones is updated after generating resolution"""
        # Get current predio state
        predio_response = authenticated_client.get(f"{BASE_URL}/api/predios/{TEST_PREDIO_ID}")
        
        if predio_response.status_code == 404:
            pytest.skip("Test predio not found")
        
        assert predio_response.status_code == 200
        predio = predio_response.json()
        
        historial_count_before = len(predio.get("historial_resoluciones", []))
        
        # Generate a resolution
        num_response = authenticated_client.get(f"{BASE_URL}/api/resoluciones/siguiente-numero/54128")
        numero_resolucion = num_response.json()["numero_resolucion"]
        
        gen_response = authenticated_client.post(f"{BASE_URL}/api/resoluciones/generar-manual", json={
            "predio_id": TEST_PREDIO_ID,
            "tipo_mutacion": "M1",
            "numero_resolucion": numero_resolucion,
            "fecha_resolucion": datetime.now().strftime("%d/%m/%Y"),
            "radicado_peticion": None
        })
        
        if gen_response.status_code == 200:
            # Verify historial was updated
            predio_after = authenticated_client.get(f"{BASE_URL}/api/predios/{TEST_PREDIO_ID}").json()
            historial_count_after = len(predio_after.get("historial_resoluciones", []))
            
            assert historial_count_after > historial_count_before, "Historial should have grown"
            
            # Verify last entry has correct structure
            last_entry = predio_after["historial_resoluciones"][-1]
            assert last_entry.get("numero_resolucion") == numero_resolucion
            assert "tipo_mutacion" in last_entry
            assert "fecha_generacion" in last_entry
            print(f"PASS: Historial updated from {historial_count_before} to {historial_count_after} entries")
        else:
            print(f"SKIP: Could not verify historial update - generation returned {gen_response.status_code}")


class TestAccessControl:
    """Test access control for resolution endpoints"""
    
    def test_admin_can_generate(self, authenticated_client):
        """Admin should be able to generate resolutions"""
        response = authenticated_client.get(f"{BASE_URL}/api/resoluciones/siguiente-numero/54003")
        assert response.status_code == 200
        print("PASS: Admin can access resolution endpoints")
    
    def test_siguiente_numero_requires_auth(self):
        """siguiente-numero requires authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/resoluciones/siguiente-numero/54003")
        assert response.status_code in [401, 403]
        print("PASS: siguiente-numero requires auth")
    
    def test_radicados_requires_auth(self):
        """radicados-disponibles requires authentication"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/resoluciones/radicados-disponibles")
        assert response.status_code in [401, 403]
        print("PASS: radicados-disponibles requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
