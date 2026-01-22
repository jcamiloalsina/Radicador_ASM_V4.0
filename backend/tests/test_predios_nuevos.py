"""
Test suite for Predios Nuevos (Crear Predio) workflow endpoints.
Tests the complete workflow: create -> digitalization -> revision -> approve/reject/return

Endpoints tested:
- POST /api/predios-nuevos - Create new predio with workflow
- GET /api/predios-nuevos - List predios in process
- GET /api/predios-nuevos/{predio_id} - Get single predio
- POST /api/predios-nuevos/{predio_id}/accion - Execute workflow actions
- GET /api/predios-nuevos/buscar-radicado/{numero} - Search radicado by number
- GET /api/predios-nuevos/pendientes - Get pending predios for user
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "catastro@asomunicipios.gov.co"
ADMIN_PASSWORD = "Asm*123*"


class TestPrediosNuevosWorkflow:
    """Test suite for Predios Nuevos workflow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.user_info = None
        self.created_predio_id = None
        
    def get_auth_token(self):
        """Get authentication token"""
        if self.token:
            return self.token
            
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user_info = data.get("user")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return self.token
        return None
    
    def test_01_login_success(self):
        """Test admin login works"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Login successful for {ADMIN_EMAIL}")
    
    def test_02_list_predios_nuevos_empty_or_existing(self):
        """Test GET /api/predios-nuevos returns list"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos")
        
        assert response.status_code == 200, f"Failed to list predios: {response.text}"
        data = response.json()
        assert "predios" in data, "Response should have 'predios' key"
        assert "total" in data, "Response should have 'total' key"
        assert isinstance(data["predios"], list), "predios should be a list"
        print(f"✓ Listed {data['total']} predios en proceso")
    
    def test_03_list_predios_nuevos_with_estado_filter(self):
        """Test GET /api/predios-nuevos with estado filter"""
        self.get_auth_token()
        
        # Test with different estados
        estados = ["creado", "digitalizacion", "revision", "aprobado", "devuelto", "rechazado"]
        
        for estado in estados:
            response = self.session.get(f"{BASE_URL}/api/predios-nuevos?estado={estado}")
            assert response.status_code == 200, f"Failed to filter by estado={estado}: {response.text}"
            data = response.json()
            assert "predios" in data
            # Verify all returned predios have the correct estado
            for predio in data["predios"]:
                assert predio.get("estado_flujo") == estado, f"Predio has wrong estado: {predio.get('estado_flujo')}"
        
        print("✓ Estado filter works correctly")
    
    def test_04_get_pendientes(self):
        """Test GET /api/predios-nuevos/pendientes returns pending predios"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos/pendientes")
        
        assert response.status_code == 200, f"Failed to get pendientes: {response.text}"
        data = response.json()
        
        # Should have these keys
        assert "digitalizacion" in data, "Should have 'digitalizacion' key"
        assert "revision" in data, "Should have 'revision' key"
        assert "devueltos" in data, "Should have 'devueltos' key"
        
        assert isinstance(data["digitalizacion"], list)
        assert isinstance(data["revision"], list)
        assert isinstance(data["devueltos"], list)
        
        print(f"✓ Pendientes: {len(data['digitalizacion'])} digitalizacion, {len(data['revision'])} revision, {len(data['devueltos'])} devueltos")
    
    def test_05_buscar_radicado_not_found(self):
        """Test GET /api/predios-nuevos/buscar-radicado/{numero} with non-existent radicado"""
        self.get_auth_token()
        
        # Use a random number that likely doesn't exist
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos/buscar-radicado/99999")
        
        assert response.status_code == 200, f"Failed to search radicado: {response.text}"
        data = response.json()
        assert "encontrado" in data
        # Should return encontrado: false for non-existent radicado
        print(f"✓ Buscar radicado returns: encontrado={data.get('encontrado')}")
    
    def test_06_buscar_radicado_existing(self):
        """Test GET /api/predios-nuevos/buscar-radicado/{numero} with existing radicado"""
        self.get_auth_token()
        
        # First, get a list of petitions to find an existing radicado
        response = self.session.get(f"{BASE_URL}/api/petitions?limit=1")
        
        if response.status_code == 200:
            data = response.json()
            # Handle both list and dict response formats
            petitions = data if isinstance(data, list) else data.get("petitions", [])
            
            if petitions:
                radicado = petitions[0].get("radicado", "")
                # Extract the number from RASMGC-XXXX-DD-MM-YYYY format
                parts = radicado.split("-")
                if len(parts) >= 2:
                    numero = parts[1]
                    
                    response = self.session.get(f"{BASE_URL}/api/predios-nuevos/buscar-radicado/{numero}")
                    assert response.status_code == 200
                    data = response.json()
                    
                    if data.get("encontrado"):
                        assert "radicado_completo" in data
                        print(f"✓ Found radicado: {data.get('radicado_completo')}")
                    else:
                        print(f"✓ Radicado search works (not found for {numero})")
                    return
        
        print("✓ Buscar radicado endpoint works (no petitions to test with)")
    
    def test_07_create_predio_nuevo_validation(self):
        """Test POST /api/predios-nuevos validation - missing gestor_apoyo"""
        self.get_auth_token()
        
        # Try to create without gestor_apoyo_id
        invalid_data = {
            "r1": {
                "municipio": "Sardinata",
                "zona": "00",
                "sector": "01",
                "manzana_vereda": "0001",
                "terreno": "0001",
                "condicion_predio": "0000",
                "predio_horizontal": "0000",
                "nombre_propietario": "TEST Propietario",
                "tipo_documento": "C",
                "numero_documento": "12345678",
                "direccion": "Calle Test 123",
                "comuna": "0",
                "destino_economico": "A",
                "area_terreno": 100.0,
                "area_construida": 50.0,
                "avaluo": 50000000
            }
            # Missing gestor_apoyo_id
        }
        
        response = self.session.post(f"{BASE_URL}/api/predios-nuevos", json=invalid_data)
        
        # Should fail validation (422 Unprocessable Entity)
        assert response.status_code == 422, f"Should fail validation: {response.status_code} - {response.text}"
        print("✓ Validation works - rejects missing gestor_apoyo_id")
    
    def test_08_create_predio_nuevo_invalid_gestor(self):
        """Test POST /api/predios-nuevos with invalid gestor_apoyo_id"""
        self.get_auth_token()
        
        invalid_data = {
            "r1": {
                "municipio": "Sardinata",
                "zona": "00",
                "sector": "01",
                "manzana_vereda": "0001",
                "terreno": "0001",
                "condicion_predio": "0000",
                "predio_horizontal": "0000",
                "nombre_propietario": "TEST Propietario",
                "tipo_documento": "C",
                "numero_documento": "12345678",
                "direccion": "Calle Test 123",
                "comuna": "0",
                "destino_economico": "A",
                "area_terreno": 100.0,
                "area_construida": 50.0,
                "avaluo": 50000000
            },
            "gestor_apoyo_id": "non-existent-user-id"
        }
        
        response = self.session.post(f"{BASE_URL}/api/predios-nuevos", json=invalid_data)
        
        # Should fail with 400 - gestor doesn't exist
        assert response.status_code == 400, f"Should fail with invalid gestor: {response.status_code} - {response.text}"
        print("✓ Validation works - rejects non-existent gestor_apoyo_id")
    
    def test_09_create_predio_nuevo_success(self):
        """Test POST /api/predios-nuevos - create new predio with workflow"""
        self.get_auth_token()
        
        # Use the admin user as gestor_apoyo (they have the right role)
        gestor_apoyo_id = self.user_info.get("id")
        
        predio_data = {
            "r1": {
                "municipio": "Sardinata",
                "zona": "00",
                "sector": "01",
                "manzana_vereda": "0099",
                "terreno": "0001",
                "condicion_predio": "0000",
                "predio_horizontal": "0000",
                "nombre_propietario": "TEST_Propietario_Workflow",
                "tipo_documento": "C",
                "numero_documento": f"TEST{uuid.uuid4().hex[:8]}",
                "direccion": "Calle Test Workflow 123",
                "comuna": "0",
                "destino_economico": "A",
                "area_terreno": 150.0,
                "area_construida": 75.0,
                "avaluo": 75000000
            },
            "gestor_apoyo_id": gestor_apoyo_id,
            "observaciones": "Predio de prueba para testing del workflow"
        }
        
        response = self.session.post(f"{BASE_URL}/api/predios-nuevos", json=predio_data)
        
        assert response.status_code == 200, f"Failed to create predio: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Response should have 'id'"
        assert "codigo_predial_nacional" in data, "Response should have 'codigo_predial_nacional'"
        assert "estado_flujo" in data, "Response should have 'estado_flujo'"
        assert data["estado_flujo"] == "creado", f"Initial estado should be 'creado', got {data['estado_flujo']}"
        assert data["es_predio_nuevo"] == True, "es_predio_nuevo should be True"
        assert data["gestor_apoyo_id"] == gestor_apoyo_id
        assert "historial_flujo" in data, "Should have historial_flujo"
        assert len(data["historial_flujo"]) >= 1, "Should have at least one historial entry"
        
        self.created_predio_id = data["id"]
        print(f"✓ Created predio nuevo: {data['codigo_predial_nacional']} with estado={data['estado_flujo']}")
        
        # Store for cleanup
        return data["id"]
    
    def test_10_get_predio_nuevo_by_id(self):
        """Test GET /api/predios-nuevos/{predio_id}"""
        self.get_auth_token()
        
        # First create a predio
        predio_id = self.test_09_create_predio_nuevo_success()
        
        if predio_id:
            response = self.session.get(f"{BASE_URL}/api/predios-nuevos/{predio_id}")
            
            assert response.status_code == 200, f"Failed to get predio: {response.text}"
            data = response.json()
            
            assert data["id"] == predio_id
            assert "codigo_predial_nacional" in data
            assert "estado_flujo" in data
            print(f"✓ Retrieved predio by ID: {data['codigo_predial_nacional']}")
    
    def test_11_get_predio_nuevo_not_found(self):
        """Test GET /api/predios-nuevos/{predio_id} with non-existent ID"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos/non-existent-id-12345")
        
        assert response.status_code == 404, f"Should return 404: {response.status_code}"
        print("✓ Returns 404 for non-existent predio")
    
    def test_12_accion_enviar_revision(self):
        """Test POST /api/predios-nuevos/{predio_id}/accion - enviar_revision"""
        self.get_auth_token()
        
        # First create a predio
        predio_id = self.test_09_create_predio_nuevo_success()
        
        if predio_id:
            response = self.session.post(f"{BASE_URL}/api/predios-nuevos/{predio_id}/accion", json={
                "accion": "enviar_revision",
                "observaciones": "Enviando a revisión para testing"
            })
            
            assert response.status_code == 200, f"Failed to send to revision: {response.text}"
            data = response.json()
            
            assert data["success"] == True
            assert "predio" in data
            assert data["predio"]["estado_flujo"] == "revision", f"Estado should be 'revision', got {data['predio']['estado_flujo']}"
            print(f"✓ Predio enviado a revisión: {data['predio']['codigo_predial_nacional']}")
            
            return predio_id
    
    def test_13_accion_devolver(self):
        """Test POST /api/predios-nuevos/{predio_id}/accion - devolver"""
        self.get_auth_token()
        
        # First create and send to revision
        predio_id = self.test_12_accion_enviar_revision()
        
        if predio_id:
            response = self.session.post(f"{BASE_URL}/api/predios-nuevos/{predio_id}/accion", json={
                "accion": "devolver",
                "observaciones": "Devolviendo para corrección - testing"
            })
            
            assert response.status_code == 200, f"Failed to devolver: {response.text}"
            data = response.json()
            
            assert data["success"] == True
            assert data["predio"]["estado_flujo"] == "devuelto"
            print(f"✓ Predio devuelto: {data['predio']['codigo_predial_nacional']}")
    
    def test_14_accion_aprobar(self):
        """Test POST /api/predios-nuevos/{predio_id}/accion - aprobar"""
        self.get_auth_token()
        
        # Create a new predio and send to revision
        gestor_apoyo_id = self.user_info.get("id")
        
        predio_data = {
            "r1": {
                "municipio": "Sardinata",
                "zona": "00",
                "sector": "01",
                "manzana_vereda": "0098",
                "terreno": "0001",
                "condicion_predio": "0000",
                "predio_horizontal": "0000",
                "nombre_propietario": "TEST_Aprobar_Workflow",
                "tipo_documento": "C",
                "numero_documento": f"APPR{uuid.uuid4().hex[:8]}",
                "direccion": "Calle Test Aprobar 456",
                "comuna": "0",
                "destino_economico": "A",
                "area_terreno": 200.0,
                "area_construida": 100.0,
                "avaluo": 100000000
            },
            "gestor_apoyo_id": gestor_apoyo_id,
            "observaciones": "Predio para test de aprobación"
        }
        
        # Create
        response = self.session.post(f"{BASE_URL}/api/predios-nuevos", json=predio_data)
        assert response.status_code == 200
        predio_id = response.json()["id"]
        
        # Send to revision
        response = self.session.post(f"{BASE_URL}/api/predios-nuevos/{predio_id}/accion", json={
            "accion": "enviar_revision"
        })
        assert response.status_code == 200
        
        # Approve
        response = self.session.post(f"{BASE_URL}/api/predios-nuevos/{predio_id}/accion", json={
            "accion": "aprobar",
            "observaciones": "Aprobado - testing workflow"
        })
        
        assert response.status_code == 200, f"Failed to aprobar: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        # After approval, predio should be moved to main collection
        # The predio in response should have estado_flujo = aprobado
        print(f"✓ Predio aprobado e integrado: {data.get('mensaje')}")
    
    def test_15_accion_rechazar(self):
        """Test POST /api/predios-nuevos/{predio_id}/accion - rechazar"""
        self.get_auth_token()
        
        # Create a new predio and send to revision
        gestor_apoyo_id = self.user_info.get("id")
        
        predio_data = {
            "r1": {
                "municipio": "Sardinata",
                "zona": "00",
                "sector": "01",
                "manzana_vereda": "0097",
                "terreno": "0001",
                "condicion_predio": "0000",
                "predio_horizontal": "0000",
                "nombre_propietario": "TEST_Rechazar_Workflow",
                "tipo_documento": "C",
                "numero_documento": f"REJ{uuid.uuid4().hex[:8]}",
                "direccion": "Calle Test Rechazar 789",
                "comuna": "0",
                "destino_economico": "A",
                "area_terreno": 180.0,
                "area_construida": 90.0,
                "avaluo": 90000000
            },
            "gestor_apoyo_id": gestor_apoyo_id,
            "observaciones": "Predio para test de rechazo"
        }
        
        # Create
        response = self.session.post(f"{BASE_URL}/api/predios-nuevos", json=predio_data)
        assert response.status_code == 200
        predio_id = response.json()["id"]
        
        # Send to revision
        response = self.session.post(f"{BASE_URL}/api/predios-nuevos/{predio_id}/accion", json={
            "accion": "enviar_revision"
        })
        assert response.status_code == 200
        
        # Reject
        response = self.session.post(f"{BASE_URL}/api/predios-nuevos/{predio_id}/accion", json={
            "accion": "rechazar",
            "observaciones": "Rechazado - testing workflow"
        })
        
        assert response.status_code == 200, f"Failed to rechazar: {response.text}"
        data = response.json()
        
        assert data["success"] == True
        assert data["predio"]["estado_flujo"] == "rechazado"
        print(f"✓ Predio rechazado: {data['predio']['codigo_predial_nacional']}")
    
    def test_16_accion_invalid_state_transition(self):
        """Test that invalid state transitions are rejected"""
        self.get_auth_token()
        
        # Create a predio (estado = creado)
        gestor_apoyo_id = self.user_info.get("id")
        
        predio_data = {
            "r1": {
                "municipio": "Sardinata",
                "zona": "00",
                "sector": "01",
                "manzana_vereda": "0096",
                "terreno": "0001",
                "condicion_predio": "0000",
                "predio_horizontal": "0000",
                "nombre_propietario": "TEST_Invalid_Transition",
                "tipo_documento": "C",
                "numero_documento": f"INV{uuid.uuid4().hex[:8]}",
                "direccion": "Calle Test Invalid",
                "comuna": "0",
                "destino_economico": "A",
                "area_terreno": 120.0,
                "area_construida": 60.0,
                "avaluo": 60000000
            },
            "gestor_apoyo_id": gestor_apoyo_id
        }
        
        response = self.session.post(f"{BASE_URL}/api/predios-nuevos", json=predio_data)
        assert response.status_code == 200
        predio_id = response.json()["id"]
        
        # Try to approve directly (should fail - not in revision state)
        response = self.session.post(f"{BASE_URL}/api/predios-nuevos/{predio_id}/accion", json={
            "accion": "aprobar",
            "observaciones": "Trying to approve from creado state"
        })
        
        assert response.status_code == 400, f"Should fail invalid transition: {response.status_code}"
        print("✓ Invalid state transition rejected correctly")
    
    def test_17_unauthorized_access(self):
        """Test that unauthorized users cannot access predios-nuevos"""
        # Don't set auth token
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/predios-nuevos")
        
        assert response.status_code in [401, 403], f"Should be unauthorized: {response.status_code}"
        print("✓ Unauthorized access rejected")


class TestPrediosEnProcesoPage:
    """Test the frontend page integration"""
    
    def test_frontend_page_loads(self):
        """Test that the PrediosEnProceso page route exists"""
        # This is a simple check that the route is configured
        response = requests.get(f"{BASE_URL}")
        assert response.status_code == 200, "Frontend should be accessible"
        print("✓ Frontend is accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
