"""
Test Suite for Sandbox Module - Asomunicipios Catastral
Tests all sandbox endpoints including:
- POST /api/sandbox/consultar - Query production collections (read-only)
- GET /api/sandbox/datos - Get sandbox data
- POST /api/sandbox/crear-predio - Create test predio in sandbox
- DELETE /api/sandbox/predio/{id} - Delete specific sandbox predio
- DELETE /api/sandbox/limpiar - Clear all sandbox data
- GET /api/sandbox/estadisticas - Get production vs sandbox statistics
- Authorization tests (admin-only access)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "catastro@asomunicipios.gov.co"
ADMIN_PASSWORD = "Asm*123*"


def get_admin_token():
    """Helper to get admin token"""
    session = requests.Session()
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    return None


def get_gestor_token():
    """Helper to get a non-admin token for access control tests"""
    session = requests.Session()
    # Try to find a gestor user first
    admin_token = get_admin_token()
    if admin_token:
        # Query users to find a gestor
        users_response = session.post(
            f"{BASE_URL}/api/sandbox/consultar",
            json={"coleccion": "users", "filtro": {"role": "gestor"}, "limite": 1},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if users_response.status_code == 200:
            users = users_response.json().get("resultados", [])
            if users:
                # Try to login with default password
                gestor_email = users[0].get("email")
                login_response = session.post(f"{BASE_URL}/api/auth/login", json={
                    "email": gestor_email,
                    "password": ADMIN_PASSWORD
                })
                if login_response.status_code == 200:
                    return login_response.json().get("token"), gestor_email
    return None, None


class TestSandboxAuthentication:
    """Tests for authentication and authorization"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_admin_login_success(self):
        """Test admin can login successfully"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert data["user"]["role"] == "administrador", f"Wrong role: {data['user']['role']}"
        print(f"SUCCESS: Admin login - role: {data['user']['role']}")


class TestSandboxAccessControl:
    """Tests for sandbox access control - only admins allowed"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures and get tokens"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get admin token
        admin_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if admin_response.status_code == 200:
            self.admin_token = admin_response.json().get("token")
        else:
            self.admin_token = None
            
        # Get a non-admin token
        self.gestor_token, self.gestor_email = get_gestor_token()
    
    def test_nonadmin_denied_sandbox_consultar(self):
        """Test non-admin cannot access sandbox/consultar endpoint (403)"""
        if not self.gestor_token:
            pytest.skip("Non-admin token not available")
        
        response = self.session.post(
            f"{BASE_URL}/api/sandbox/consultar",
            json={"coleccion": "predios", "filtro": {}, "limite": 5},
            headers={"Authorization": f"Bearer {self.gestor_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"SUCCESS: Non-admin ({self.gestor_email}) correctly denied access to sandbox/consultar (403)")
    
    def test_nonadmin_denied_sandbox_datos(self):
        """Test non-admin cannot access sandbox/datos endpoint (403)"""
        if not self.gestor_token:
            pytest.skip("Non-admin token not available")
        
        response = self.session.get(
            f"{BASE_URL}/api/sandbox/datos",
            headers={"Authorization": f"Bearer {self.gestor_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"SUCCESS: Non-admin correctly denied access to sandbox/datos (403)")
    
    def test_nonadmin_denied_sandbox_crear_predio(self):
        """Test non-admin cannot create predio in sandbox (403)"""
        if not self.gestor_token:
            pytest.skip("Non-admin token not available")
        
        response = self.session.post(
            f"{BASE_URL}/api/sandbox/crear-predio",
            json={"codigo_predial_nacional": "TEST-NONADMIN", "municipio": "TestMunicipio"},
            headers={"Authorization": f"Bearer {self.gestor_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"SUCCESS: Non-admin correctly denied access to sandbox/crear-predio (403)")
    
    def test_nonadmin_denied_sandbox_estadisticas(self):
        """Test non-admin cannot access sandbox/estadisticas endpoint (403)"""
        if not self.gestor_token:
            pytest.skip("Non-admin token not available")
        
        response = self.session.get(
            f"{BASE_URL}/api/sandbox/estadisticas",
            headers={"Authorization": f"Bearer {self.gestor_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"SUCCESS: Non-admin correctly denied access to sandbox/estadisticas (403)")


class TestSandboxConsultar:
    """Tests for POST /api/sandbox/consultar endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures and get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get admin token
        self.admin_token = get_admin_token()
        if not self.admin_token:
            pytest.fail("Failed to get admin token")
    
    def test_consultar_predios_collection(self):
        """Test querying predios collection"""
        response = self.session.post(
            f"{BASE_URL}/api/sandbox/consultar",
            json={"coleccion": "predios", "filtro": {}, "limite": 5},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Query failed: {response.text}"
        data = response.json()
        assert data.get("success") is True, "Success flag not True"
        assert "resultados" in data, "No resultados in response"
        assert "total" in data, "No total in response"
        print(f"SUCCESS: Queried predios - total: {data.get('total')}, showing: {data.get('mostrando')}")
    
    def test_consultar_users_collection(self):
        """Test querying users collection (sensitive data filtered)"""
        response = self.session.post(
            f"{BASE_URL}/api/sandbox/consultar",
            json={"coleccion": "users", "filtro": {}, "limite": 5},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Query failed: {response.text}"
        data = response.json()
        assert data.get("success") is True, "Success flag not True"
        
        # Verify sensitive data is excluded
        if data.get("resultados"):
            for user in data["resultados"]:
                assert "password_hash" not in user, "password_hash should be filtered out"
                assert "verification_code" not in user, "verification_code should be filtered out"
        print(f"SUCCESS: Queried users - total: {data.get('total')}, sensitive data filtered")
    
    def test_consultar_petitions_collection(self):
        """Test querying petitions collection"""
        response = self.session.post(
            f"{BASE_URL}/api/sandbox/consultar",
            json={"coleccion": "petitions", "filtro": {}, "limite": 5},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Query failed: {response.text}"
        data = response.json()
        assert data.get("success") is True, "Success flag not True"
        print(f"SUCCESS: Queried petitions - total: {data.get('total')}")
    
    def test_consultar_with_filter(self):
        """Test querying with JSON filter"""
        response = self.session.post(
            f"{BASE_URL}/api/sandbox/consultar",
            json={"coleccion": "predios", "filtro": {"municipio": "Ábrego"}, "limite": 5},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Query failed: {response.text}"
        data = response.json()
        assert data.get("success") is True, "Success flag not True"
        
        # Verify filter was applied
        if data.get("resultados"):
            for predio in data["resultados"]:
                assert predio.get("municipio") == "Ábrego", f"Filter not applied: {predio.get('municipio')}"
        print(f"SUCCESS: Queried predios with filter - found: {len(data.get('resultados', []))}")
    
    def test_consultar_invalid_collection(self):
        """Test querying invalid collection returns 400"""
        response = self.session.post(
            f"{BASE_URL}/api/sandbox/consultar",
            json={"coleccion": "invalid_collection", "filtro": {}, "limite": 5},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print(f"SUCCESS: Invalid collection correctly rejected (400)")
    
    def test_consultar_respects_limit(self):
        """Test that limit parameter is respected"""
        response = self.session.post(
            f"{BASE_URL}/api/sandbox/consultar",
            json={"coleccion": "predios", "filtro": {}, "limite": 3},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Query failed: {response.text}"
        data = response.json()
        assert len(data.get("resultados", [])) <= 3, "Limit not respected"
        print(f"SUCCESS: Limit respected - got {len(data.get('resultados', []))} results")


class TestSandboxCRUD:
    """Tests for sandbox CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures and get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get admin token
        self.admin_token = get_admin_token()
        if not self.admin_token:
            pytest.fail("Failed to get admin token")
    
    def test_get_sandbox_datos(self):
        """Test GET /api/sandbox/datos returns sandbox data"""
        response = self.session.get(
            f"{BASE_URL}/api/sandbox/datos",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Get datos failed: {response.text}"
        data = response.json()
        assert data.get("success") is True, "Success flag not True"
        assert "datos" in data, "No datos in response"
        assert "total" in data, "No total in response"
        print(f"SUCCESS: Get sandbox datos - total: {data.get('total')}")
    
    def test_crear_predio_sandbox(self):
        """Test creating a predio in sandbox"""
        unique_code = f"TEST-{uuid.uuid4().hex[:8].upper()}"
        predio_data = {
            "codigo_predial_nacional": unique_code,
            "municipio": "Municipio Test",
            "nombre_propietario": "Propietario Test",
            "direccion": "Calle Test #123",
            "area_terreno": 150.5,
            "area_construida": 80.0,
            "avaluo": 75000000
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/sandbox/crear-predio",
            json=predio_data,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        assert data.get("success") is True, "Success flag not True"
        assert "predio" in data, "No predio in response"
        
        # Verify predio data
        predio = data["predio"]
        assert predio.get("codigo_predial_nacional") == unique_code
        assert predio.get("municipio") == "Municipio Test"
        assert predio.get("es_sandbox") is True, "es_sandbox flag should be True"
        assert "id" in predio, "No id in predio"
        
        # Store for cleanup
        self.created_predio_id = predio.get("id")
        print(f"SUCCESS: Created sandbox predio - id: {self.created_predio_id}")
        
        # Cleanup: delete the created predio
        if self.created_predio_id:
            self.session.delete(
                f"{BASE_URL}/api/sandbox/predio/{self.created_predio_id}",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
    
    def test_crear_and_delete_predio_sandbox(self):
        """Test creating and then deleting a predio from sandbox"""
        # Create
        unique_code = f"TEST-DELETE-{uuid.uuid4().hex[:8].upper()}"
        create_response = self.session.post(
            f"{BASE_URL}/api/sandbox/crear-predio",
            json={"codigo_predial_nacional": unique_code, "municipio": "ToDelete"},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        predio_id = create_response.json()["predio"]["id"]
        print(f"Created predio with id: {predio_id}")
        
        # Delete
        delete_response = self.session.delete(
            f"{BASE_URL}/api/sandbox/predio/{predio_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        data = delete_response.json()
        assert data.get("success") is True, "Success flag not True"
        print(f"SUCCESS: Created and deleted sandbox predio - id: {predio_id}")
    
    def test_delete_nonexistent_predio(self):
        """Test deleting non-existent predio returns 404"""
        fake_id = str(uuid.uuid4())
        response = self.session.delete(
            f"{BASE_URL}/api/sandbox/predio/{fake_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print(f"SUCCESS: Non-existent predio correctly returns 404")
    
    def test_get_estadisticas(self):
        """Test GET /api/sandbox/estadisticas returns production vs sandbox stats"""
        response = self.session.get(
            f"{BASE_URL}/api/sandbox/estadisticas",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert response.status_code == 200, f"Get estadisticas failed: {response.text}"
        data = response.json()
        assert data.get("success") is True, "Success flag not True"
        
        # Verify structure
        assert "produccion" in data, "No produccion in response"
        assert "sandbox" in data, "No sandbox in response"
        
        # Verify production stats
        produccion = data["produccion"]
        assert "predios" in produccion, "No predios count in produccion"
        assert "usuarios" in produccion, "No usuarios count in produccion"
        assert "peticiones" in produccion, "No peticiones count in produccion"
        
        # Verify sandbox stats
        sandbox = data["sandbox"]
        assert "predios" in sandbox, "No predios count in sandbox"
        
        print(f"SUCCESS: Got estadisticas - prod predios: {produccion.get('predios')}, sandbox predios: {sandbox.get('predios')}")


class TestSandboxLimpiar:
    """Tests for DELETE /api/sandbox/limpiar endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures and get admin token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get admin token
        self.admin_token = get_admin_token()
        if not self.admin_token:
            pytest.fail("Failed to get admin token")
    
    def test_limpiar_sandbox(self):
        """Test clearing all sandbox data"""
        # First create a test predio
        create_response = self.session.post(
            f"{BASE_URL}/api/sandbox/crear-predio",
            json={"codigo_predial_nacional": "TEST-LIMPIAR", "municipio": "ToLimpiar"},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        
        # Now clear sandbox
        limpiar_response = self.session.delete(
            f"{BASE_URL}/api/sandbox/limpiar",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert limpiar_response.status_code == 200, f"Limpiar failed: {limpiar_response.text}"
        data = limpiar_response.json()
        assert data.get("success") is True, "Success flag not True"
        assert "message" in data, "No message in response"
        print(f"SUCCESS: Sandbox cleared - {data.get('message')}")
        
        # Verify sandbox is empty
        datos_response = self.session.get(
            f"{BASE_URL}/api/sandbox/datos",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        assert datos_response.status_code == 200
        assert datos_response.json().get("total") == 0, "Sandbox should be empty after limpiar"
        print(f"SUCCESS: Verified sandbox is empty after limpiar")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
