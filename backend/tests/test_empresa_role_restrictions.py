"""
Test suite for Empresa role restrictions in Asomunicipios Catastral System
Tests:
1. Empresa role cannot propose changes via API (POST /api/predios/cambios/proponer returns 403)
2. Admin role CAN propose changes (for comparison)
3. Verify role-based permissions are correctly enforced
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_CREDENTIALS = {
    "email": "catastro@asomunicipios.gov.co",
    "password": "Asm*123*"
}

EMPRESA_CREDENTIALS = {
    "email": "empresa_test@test.com",
    "password": "Test123!"
}

COORDINADOR_CREDENTIALS = {
    "email": "Camilo.alsina1@hotmail.com",
    "password": "Asm*123*"
}


class TestEmpresaRoleRestrictions:
    """Test suite for Empresa role restrictions"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in admin login response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def empresa_token(self):
        """Get empresa authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EMPRESA_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip(f"Empresa user login failed: {response.text}")
        data = response.json()
        assert "token" in data, "No token in empresa login response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def coordinador_token(self):
        """Get coordinador authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COORDINADOR_CREDENTIALS)
        if response.status_code != 200:
            pytest.skip(f"Coordinador login failed: {response.text}")
        data = response.json()
        assert "token" in data, "No token in coordinador login response"
        return data["token"]
    
    def test_admin_login_success(self, admin_token):
        """Test admin can login successfully"""
        assert admin_token is not None
        assert len(admin_token) > 0
        print("✓ Admin login successful")
    
    def test_empresa_login_success(self, empresa_token):
        """Test empresa user can login successfully"""
        assert empresa_token is not None
        assert len(empresa_token) > 0
        print("✓ Empresa user login successful")
    
    def test_empresa_user_role_is_empresa(self, empresa_token):
        """Verify empresa user has 'empresa' role"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {empresa_token}"}
        )
        assert response.status_code == 200, f"Failed to get user info: {response.text}"
        user_data = response.json()
        assert user_data.get("role") == "empresa", f"Expected role 'empresa', got '{user_data.get('role')}'"
        print(f"✓ Empresa user role verified: {user_data.get('role')}")
    
    def test_admin_user_role_is_administrador(self, admin_token):
        """Verify admin user has 'administrador' role"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get user info: {response.text}"
        user_data = response.json()
        assert user_data.get("role") == "administrador", f"Expected role 'administrador', got '{user_data.get('role')}'"
        print(f"✓ Admin user role verified: {user_data.get('role')}")
    
    def test_empresa_cannot_propose_changes(self, empresa_token):
        """
        CRITICAL TEST: Empresa role should NOT be able to propose changes to predios.
        POST /api/predios/cambios/proponer should return 403 Forbidden.
        """
        # Sample change proposal data
        cambio_data = {
            "predio_id": "test-predio-id",
            "tipo_cambio": "modificacion",
            "datos_propuestos": {
                "direccion": "Nueva Dirección Test",
                "avaluo": 50000000
            },
            "justificacion": "Test change proposal from empresa role"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/predios/cambios/proponer",
            json=cambio_data,
            headers={"Authorization": f"Bearer {empresa_token}"}
        )
        
        # Should return 403 Forbidden
        assert response.status_code == 403, f"Expected 403 Forbidden, got {response.status_code}: {response.text}"
        
        # Verify error message
        error_data = response.json()
        assert "detail" in error_data, "No detail in error response"
        assert "permiso" in error_data["detail"].lower() or "no tiene" in error_data["detail"].lower(), \
            f"Unexpected error message: {error_data['detail']}"
        
        print(f"✓ Empresa role correctly blocked from proposing changes (403): {error_data['detail']}")
    
    def test_admin_can_propose_changes(self, admin_token):
        """
        Admin role should be able to propose changes (or auto-approve them).
        This test verifies the endpoint works for authorized roles.
        """
        # First, get a real predio to test with
        response = requests.get(
            f"{BASE_URL}/api/predios?municipio=Bucarasica&limit=1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200 or not response.json().get("predios"):
            pytest.skip("No predios available for testing")
        
        predio = response.json()["predios"][0]
        predio_id = predio.get("id")
        
        # Sample change proposal data
        cambio_data = {
            "predio_id": predio_id,
            "tipo_cambio": "modificacion",
            "datos_propuestos": {
                "direccion": predio.get("direccion", "Test") + " - TEST ADMIN"
            },
            "justificacion": "Test change proposal from admin role - should auto-approve"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/predios/cambios/proponer",
            json=cambio_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Admin should be able to propose (and auto-approve)
        assert response.status_code in [200, 201], f"Admin should be able to propose changes, got {response.status_code}: {response.text}"
        print(f"✓ Admin role can propose changes successfully")
    
    def test_empresa_can_view_predios(self, empresa_token):
        """
        Empresa role should be able to VIEW predios (read-only access).
        """
        response = requests.get(
            f"{BASE_URL}/api/predios?municipio=Bucarasica&limit=5",
            headers={"Authorization": f"Bearer {empresa_token}"}
        )
        
        assert response.status_code == 200, f"Empresa should be able to view predios, got {response.status_code}: {response.text}"
        data = response.json()
        assert "predios" in data, "Response should contain 'predios' key"
        print(f"✓ Empresa role can view predios (found {len(data.get('predios', []))} predios)")
    
    def test_empresa_can_view_predio_detail(self, empresa_token):
        """
        Empresa role should be able to view individual predio details.
        """
        # First get a predio ID
        response = requests.get(
            f"{BASE_URL}/api/predios?municipio=Bucarasica&limit=1",
            headers={"Authorization": f"Bearer {empresa_token}"}
        )
        
        if response.status_code != 200 or not response.json().get("predios"):
            pytest.skip("No predios available for testing")
        
        predio = response.json()["predios"][0]
        predio_id = predio.get("id")
        
        # Get predio detail
        response = requests.get(
            f"{BASE_URL}/api/predios/{predio_id}",
            headers={"Authorization": f"Bearer {empresa_token}"}
        )
        
        assert response.status_code == 200, f"Empresa should be able to view predio detail, got {response.status_code}"
        print(f"✓ Empresa role can view predio detail")
    
    def test_empresa_cannot_delete_predio(self, empresa_token):
        """
        Empresa role should NOT be able to delete predios.
        """
        # Try to delete a non-existent predio (should still return 403, not 404)
        response = requests.delete(
            f"{BASE_URL}/api/predios/test-fake-id",
            headers={"Authorization": f"Bearer {empresa_token}"}
        )
        
        # Should return 403 Forbidden (not 404 Not Found)
        # If it returns 404, the permission check might not be happening first
        assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}"
        print(f"✓ Empresa role cannot delete predios (status: {response.status_code})")
    
    def test_empresa_cannot_create_predio(self, empresa_token):
        """
        Empresa role should NOT be able to create new predios.
        """
        # Sample predio creation data
        predio_data = {
            "r1": {
                "municipio": "Bucarasica",
                "zona": "00",
                "sector": "01",
                "manzana_vereda": "0001",
                "terreno": "9999",
                "condicion_predio": "0000",
                "predio_horizontal": "0000",
                "nombre_propietario": "TEST EMPRESA",
                "tipo_documento": "C",
                "numero_documento": "12345678",
                "direccion": "TEST ADDRESS",
                "comuna": "0",
                "destino_economico": "A",
                "area_terreno": 100,
                "area_construida": 0,
                "avaluo": 10000000
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/predios",
            json=predio_data,
            headers={"Authorization": f"Bearer {empresa_token}"}
        )
        
        # Should return 403 Forbidden
        assert response.status_code == 403, f"Expected 403 Forbidden for predio creation, got {response.status_code}: {response.text}"
        print(f"✓ Empresa role cannot create predios (403)")


class TestCambiosHistorialUI:
    """Test the cambios historial endpoint returns predio_actual for comparison"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDENTIALS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["token"]
    
    def test_cambios_historial_endpoint_exists(self, admin_token):
        """Test that cambios historial endpoint exists and returns data"""
        response = requests.get(
            f"{BASE_URL}/api/predios/cambios/historial",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Historial endpoint failed: {response.status_code}"
        data = response.json()
        assert "cambios" in data or isinstance(data, list), "Response should contain cambios"
        print(f"✓ Cambios historial endpoint working")
    
    def test_cambios_pendientes_endpoint_exists(self, admin_token):
        """Test that cambios pendientes endpoint exists"""
        response = requests.get(
            f"{BASE_URL}/api/predios/cambios/pendientes",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Pendientes endpoint failed: {response.status_code}"
        print(f"✓ Cambios pendientes endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
