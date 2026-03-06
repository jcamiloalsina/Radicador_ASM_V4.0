"""
Test suite for Actualización → Conservación flow
Tests:
1. POST /api/actualizacion/proyectos/{id}/predios-nuevos - Create new predio
2. GET /api/actualizacion/proyectos/{id}/resumen-finalizacion - Get finalization summary
3. Verify es_nuevo flag and codigo_homologado assignment
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://m5-predio-modal.preview.emergentagent.com').rstrip('/')

# Test credentials
COORDINADOR_EMAIL = "Camilo.alsina1@hotmail.com"
COORDINADOR_PASSWORD = "Asm*123*"
PROYECTO_ID = "32ba040f-ed50-45e2-a115-22ab3a351423"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for coordinador"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": COORDINADOR_EMAIL, "password": COORDINADOR_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    token = data.get('token') or data.get('access_token')
    assert token, "No token in response"
    return token


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestResumenFinalizacion:
    """Tests for GET /api/actualizacion/proyectos/{id}/resumen-finalizacion"""
    
    def test_resumen_finalizacion_returns_200(self, api_client):
        """Test that resumen-finalizacion endpoint returns 200"""
        response = api_client.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/resumen-finalizacion"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_resumen_finalizacion_structure(self, api_client):
        """Test that resumen-finalizacion returns correct structure"""
        response = api_client.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/resumen-finalizacion"
        )
        data = response.json()
        
        # Verify main sections exist
        assert "proyecto" in data, "Missing 'proyecto' section"
        assert "resumen" in data, "Missing 'resumen' section"
        assert "propuestas" in data, "Missing 'propuestas' section"
        assert "migracion" in data, "Missing 'migracion' section"
        assert "validaciones" in data, "Missing 'validaciones' section"
    
    def test_resumen_counts_predios_nuevos(self, api_client):
        """Test that resumen correctly counts predios_nuevos"""
        response = api_client.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/resumen-finalizacion"
        )
        data = response.json()
        
        resumen = data.get("resumen", {})
        assert "predios_nuevos" in resumen, "Missing 'predios_nuevos' in resumen"
        assert isinstance(resumen["predios_nuevos"], int), "predios_nuevos should be int"
        assert resumen["predios_nuevos"] >= 0, "predios_nuevos should be >= 0"
        
        # Verify migracion section matches
        migracion = data.get("migracion", {})
        assert migracion.get("predios_nuevos_a_crear") == resumen["predios_nuevos"], \
            "migracion.predios_nuevos_a_crear should match resumen.predios_nuevos"
    
    def test_resumen_validaciones(self, api_client):
        """Test that validaciones section has required fields"""
        response = api_client.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/resumen-finalizacion"
        )
        data = response.json()
        
        validaciones = data.get("validaciones", {})
        assert "predios_pendientes" in validaciones
        assert "propuestas_pendientes" in validaciones
        assert "propuestas_subsanacion" in validaciones
        assert "puede_finalizar" in validaciones


class TestCrearPredioNuevo:
    """Tests for POST /api/actualizacion/proyectos/{id}/predios-nuevos"""
    
    def test_crear_predio_nuevo_success(self, api_client):
        """Test creating a new predio returns codigo_predial and codigo_homologado"""
        # Generate unique terreno number to avoid duplicates
        terreno_num = str(uuid.uuid4().int)[:4].zfill(4)
        
        payload = {
            "r1": {
                "zona": "00",
                "sector": "01",
                "comuna": "02",
                "barrio": "03",
                "manzana_vereda": "0088",
                "terreno": terreno_num,
                "condicion_predio": "0",
                "predio_horizontal": "00000",
                "direccion": f"VEREDA TEST PYTEST {terreno_num}",
                "destino_economico": "D",
                "area_terreno": 1000,
                "area_construida": 50,
                "avaluo": 25000000
            },
            "r2": {
                "matricula_inmobiliaria": f"270-{terreno_num}"
            },
            "propietarios": [{
                "tipo_documento": "C",
                "numero_documento": "99999999",
                "nombre_propietario": "TEST PYTEST USER",
                "primer_nombre": "TEST",
                "segundo_nombre": "",
                "primer_apellido": "PYTEST",
                "segundo_apellido": "USER",
                "porcentaje": 100
            }],
            "zonas_fisicas": [],
            "formato_visita": {
                "observaciones": "Predio creado por pytest",
                "fecha_visita": "2026-01-12"
            }
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/predios-nuevos",
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response contains required fields
        assert "codigo_predial" in data, "Missing 'codigo_predial' in response"
        assert "codigo_homologado" in data, "Missing 'codigo_homologado' in response"
        assert "predio_id" in data, "Missing 'predio_id' in response"
        
        # Verify codigo_predial is 30 digits
        assert len(data["codigo_predial"]) == 30, f"codigo_predial should be 30 digits, got {len(data['codigo_predial'])}"
        
        # Verify codigo_homologado format (starts with BPP)
        assert data["codigo_homologado"].startswith("BPP"), f"codigo_homologado should start with BPP"
    
    def test_crear_predio_nuevo_sets_es_nuevo_flag(self, api_client):
        """Test that created predio has es_nuevo: true"""
        # First create a predio
        terreno_num = str(uuid.uuid4().int)[:4].zfill(4)
        
        payload = {
            "r1": {
                "zona": "00",
                "sector": "01",
                "comuna": "02",
                "barrio": "04",
                "manzana_vereda": "0077",
                "terreno": terreno_num,
                "condicion_predio": "0",
                "predio_horizontal": "00000",
                "direccion": f"VEREDA ES_NUEVO TEST {terreno_num}",
                "destino_economico": "D",
                "area_terreno": 800,
                "area_construida": 0,
                "avaluo": 15000000
            },
            "r2": {},
            "propietarios": [{
                "tipo_documento": "C",
                "numero_documento": "88888888",
                "nombre_propietario": "ES NUEVO TEST",
                "primer_nombre": "ES",
                "primer_apellido": "NUEVO",
                "porcentaje": 100
            }],
            "zonas_fisicas": [],
            "formato_visita": {}
        }
        
        create_response = api_client.post(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/predios-nuevos",
            json=payload
        )
        
        assert create_response.status_code == 200
        created_data = create_response.json()
        codigo_predial = created_data["codigo_predial"]
        
        # Now fetch predios and verify es_nuevo flag
        list_response = api_client.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/predios?limit=5000"
        )
        
        assert list_response.status_code == 200
        predios = list_response.json().get("predios", [])
        
        # Find the created predio
        created_predio = next(
            (p for p in predios if p.get("codigo_predial") == codigo_predial),
            None
        )
        
        assert created_predio is not None, f"Created predio not found in list"
        assert created_predio.get("es_nuevo") == True, "es_nuevo should be True"
    
    def test_crear_predio_nuevo_duplicate_fails(self, api_client):
        """Test that creating duplicate predio fails"""
        # Use a fixed terreno number
        payload = {
            "r1": {
                "zona": "00",
                "sector": "01",
                "comuna": "02",
                "barrio": "03",
                "manzana_vereda": "0099",
                "terreno": "9999",  # Same as previous test
                "condicion_predio": "0",
                "predio_horizontal": "00000",
                "direccion": "DUPLICATE TEST",
                "destino_economico": "D",
                "area_terreno": 100,
                "area_construida": 0,
                "avaluo": 1000000
            },
            "r2": {},
            "propietarios": [],
            "zonas_fisicas": [],
            "formato_visita": {}
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/predios-nuevos",
            json=payload
        )
        
        # Should fail with 400 because predio already exists
        assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"
        assert "existe" in response.json().get("detail", "").lower()


class TestPrediosNuevosIntegration:
    """Integration tests for predios nuevos flow"""
    
    def test_resumen_updates_after_creating_predio(self, api_client):
        """Test that resumen-finalizacion updates after creating a new predio"""
        # Get initial count
        initial_response = api_client.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/resumen-finalizacion"
        )
        initial_count = initial_response.json()["resumen"]["predios_nuevos"]
        
        # Create a new predio
        terreno_num = str(uuid.uuid4().int)[:4].zfill(4)
        payload = {
            "r1": {
                "zona": "00",
                "sector": "02",
                "comuna": "03",
                "barrio": "04",
                "manzana_vereda": "0066",
                "terreno": terreno_num,
                "condicion_predio": "0",
                "predio_horizontal": "00000",
                "direccion": f"INTEGRATION TEST {terreno_num}",
                "destino_economico": "D",
                "area_terreno": 500,
                "area_construida": 0,
                "avaluo": 10000000
            },
            "r2": {},
            "propietarios": [{
                "tipo_documento": "C",
                "numero_documento": "77777777",
                "nombre_propietario": "INTEGRATION TEST",
                "primer_nombre": "INTEGRATION",
                "primer_apellido": "TEST",
                "porcentaje": 100
            }],
            "zonas_fisicas": [],
            "formato_visita": {}
        }
        
        create_response = api_client.post(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/predios-nuevos",
            json=payload
        )
        assert create_response.status_code == 200
        
        # Get updated count
        updated_response = api_client.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROYECTO_ID}/resumen-finalizacion"
        )
        updated_count = updated_response.json()["resumen"]["predios_nuevos"]
        
        # Verify count increased
        assert updated_count == initial_count + 1, \
            f"Expected predios_nuevos to increase from {initial_count} to {initial_count + 1}, got {updated_count}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
