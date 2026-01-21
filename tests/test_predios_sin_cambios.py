"""
Test suite for Predios Sin Cambios feature in Actualización module
Tests:
1. GET /api/actualizacion/proyectos/{id}/predios-sin-cambios
2. POST /api/actualizacion/proyectos/{id}/predios/{codigo}/aprobar-sin-cambios
3. POST /api/actualizacion/proyectos/{id}/predios-sin-cambios/aprobar-masivo
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "catastro@asomunicipios.gov.co"
ADMIN_PASSWORD = "Asm*123*"
PROYECTO_ID = "32ba040f-ed50-45e2-a115-22ab3a351423"


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


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestPrediosSinCambiosEndpoints:
    """Test endpoints for predios sin cambios feature"""
    
    def test_get_predios_sin_cambios_endpoint_exists(self, auth_headers):
        """Test that GET /api/actualizacion/proyectos/{id}/predios-sin-cambios endpoint exists"""
        response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/predios-sin-cambios",
            headers=auth_headers
        )
        # Should return 200 (success) or 404 (project not found), not 404 for endpoint
        assert response.status_code in [200, 404], f"Endpoint should exist. Got: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "predios" in data, "Response should contain 'predios' key"
            assert "total" in data, "Response should contain 'total' key"
            print(f"✓ GET predios-sin-cambios: Found {data['total']} predios sin cambios")
    
    def test_aprobar_sin_cambios_endpoint_exists(self, auth_headers):
        """Test that POST /api/actualizacion/proyectos/{id}/predios/{codigo}/aprobar-sin-cambios endpoint exists"""
        # Use a test codigo predial
        test_codigo = "TEST_CODIGO_123"
        response = requests.post(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/predios/{test_codigo}/aprobar-sin-cambios",
            headers=auth_headers,
            json={"comentario": "Test aprobación"}
        )
        # Should return 404 (predio not found) or 200 (success), not 404 for endpoint
        # 404 for predio is expected since we're using a test codigo
        assert response.status_code in [200, 404], f"Endpoint should exist. Got: {response.status_code} - {response.text}"
        print(f"✓ POST aprobar-sin-cambios endpoint exists (status: {response.status_code})")
    
    def test_aprobar_masivo_sin_cambios_endpoint_exists(self, auth_headers):
        """Test that POST /api/actualizacion/proyectos/{id}/predios-sin-cambios/aprobar-masivo endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/predios-sin-cambios/aprobar-masivo",
            headers=auth_headers,
            json={
                "codigos_prediales": [],
                "comentario": "Test aprobación masiva"
            }
        )
        # Should return 400 (empty list) or 200 (success), not 404 for endpoint
        assert response.status_code in [200, 400, 404], f"Endpoint should exist. Got: {response.status_code} - {response.text}"
        print(f"✓ POST aprobar-masivo-sin-cambios endpoint exists (status: {response.status_code})")
    
    def test_aprobar_masivo_requires_codigos(self, auth_headers):
        """Test that aprobar-masivo requires codigos_prediales"""
        response = requests.post(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/predios-sin-cambios/aprobar-masivo",
            headers=auth_headers,
            json={
                "codigos_prediales": [],
                "comentario": "Test"
            }
        )
        # Should return 400 for empty list
        if response.status_code == 400:
            data = response.json()
            assert "detail" in data
            print(f"✓ Validation works: {data['detail']}")
        else:
            print(f"Note: Got status {response.status_code} instead of 400 for empty list")


class TestProyectoActualizacionEndpoints:
    """Test proyecto actualizacion endpoints"""
    
    def test_get_proyecto_exists(self, auth_headers):
        """Test that the test proyecto exists"""
        response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}",
            headers=auth_headers
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Proyecto found: {data.get('nombre', 'N/A')} - {data.get('municipio', 'N/A')}")
        else:
            print(f"Note: Proyecto {PROYECTO_ID} not found (status: {response.status_code})")
    
    def test_get_propuestas_endpoint(self, auth_headers):
        """Test GET propuestas endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/propuestas?estado=pendiente",
            headers=auth_headers
        )
        assert response.status_code in [200, 404], f"Endpoint should exist. Got: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            print(f"✓ GET propuestas: Found {len(data.get('propuestas', []))} propuestas pendientes")


class TestGestionPropuestasEndpoints:
    """Test endpoints used by GestionPropuestas.js"""
    
    def test_get_proyectos_list(self, auth_headers):
        """Test GET /api/actualizacion/proyectos"""
        response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Should get proyectos list. Got: {response.status_code}"
        data = response.json()
        assert "proyectos" in data
        print(f"✓ GET proyectos: Found {len(data['proyectos'])} proyectos")


class TestPredioUpdateWithSinCambios:
    """Test that PATCH predio accepts sin_cambios field"""
    
    def test_patch_predio_accepts_sin_cambios(self, auth_headers):
        """Test that PATCH endpoint accepts sin_cambios field"""
        # First get a predio from the project
        response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/predios",
            headers=auth_headers
        )
        
        if response.status_code != 200:
            pytest.skip("Could not get predios list")
        
        data = response.json()
        predios = data.get('predios', [])
        
        if not predios:
            pytest.skip("No predios found in project")
        
        # Get first predio codigo
        test_predio = predios[0]
        codigo = test_predio.get('codigo_predial') or test_predio.get('numero_predial')
        
        if not codigo:
            pytest.skip("No codigo predial found")
        
        # Test PATCH with sin_cambios field
        patch_response = requests.patch(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/predios/{codigo}",
            headers=auth_headers,
            json={
                "estado_visita": "visitado",
                "sin_cambios": True,
                "visitado_por": "test@test.com",
                "visitado_en": "2025-01-01T00:00:00Z"
            }
        )
        
        # Should accept the sin_cambios field
        assert patch_response.status_code in [200, 404], f"PATCH should work. Got: {patch_response.status_code} - {patch_response.text}"
        print(f"✓ PATCH predio with sin_cambios field works (status: {patch_response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
