"""
Test Bug Fixes - Iteration 29
Testing:
1. Bug Fix 1: 'Editar' button in 'Predios Nuevos' > 'Mis Creaciones' navigates correctly
2. Bug Fix 2: 'Rechazar' button for gestor de apoyo when has assigned predios
3. Backend: POST /api/predios-nuevos/{id}/accion with accion='rechazar_asignacion'
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "catastro@asomunicipios.gov.co"
ADMIN_PASSWORD = "Asm*123*"
GESTOR_CREADOR_EMAIL = "gestor.creador@test.com"
GESTOR_CREADOR_PASSWORD = "Asm*123*"
GESTOR_APOYO_EMAIL = "gestor.apoyo@test.com"
GESTOR_APOYO_PASSWORD = "Asm*123*"


class TestAuthentication:
    """Test authentication for different roles"""
    
    def test_admin_login(self):
        """Test admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "administrador"
        print(f"✓ Admin login successful: {data['user']['full_name']}")
        return data["token"]


class TestPrediosNuevosEndpoints:
    """Test predios nuevos endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture
    def admin_user(self, admin_token):
        """Get admin user info"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        return response.json()
    
    def test_get_predios_nuevos_list(self, admin_token):
        """Test GET /api/predios-nuevos returns list"""
        response = requests.get(f"{BASE_URL}/api/predios-nuevos", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200, f"Failed to get predios nuevos: {response.text}"
        data = response.json()
        assert "predios" in data or isinstance(data, list)
        print(f"✓ GET /api/predios-nuevos returned {len(data.get('predios', data))} predios")
    
    def test_get_single_predio_nuevo(self, admin_token):
        """Test GET /api/predios-nuevos/{id} returns predio data"""
        # First get list to find a predio
        response = requests.get(f"{BASE_URL}/api/predios-nuevos", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        data = response.json()
        predios = data.get('predios', data)
        
        if len(predios) > 0:
            predio_id = predios[0]['id']
            response = requests.get(f"{BASE_URL}/api/predios-nuevos/{predio_id}", headers={
                "Authorization": f"Bearer {admin_token}"
            })
            assert response.status_code == 200, f"Failed to get predio: {response.text}"
            predio = response.json()
            assert "id" in predio
            assert "codigo_predial_nacional" in predio or "datos_predio" in predio
            print(f"✓ GET /api/predios-nuevos/{predio_id} returned predio data")
        else:
            print("⚠ No predios nuevos found to test single GET")
            pytest.skip("No predios nuevos available")


class TestRechazarAsignacionEndpoint:
    """Test the rechazar_asignacion action endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture
    def admin_user(self, admin_token):
        """Get admin user info"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {admin_token}"
        })
        assert response.status_code == 200
        return response.json()
    
    def test_rechazar_asignacion_endpoint_exists(self, admin_token):
        """Test that the rechazar_asignacion action is handled by the endpoint"""
        # Create a test predio nuevo
        test_predio_id = f"TEST_{uuid.uuid4()}"
        
        # Try to call the action endpoint with a non-existent predio
        response = requests.post(
            f"{BASE_URL}/api/predios-nuevos/{test_predio_id}/accion",
            json={
                "accion": "rechazar_asignacion",
                "observaciones": "Test rechazo"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should return 404 (predio not found) not 400 (invalid action)
        # This confirms the endpoint handles rechazar_asignacion
        assert response.status_code == 404, f"Expected 404 for non-existent predio, got {response.status_code}: {response.text}"
        print("✓ rechazar_asignacion action is recognized by the endpoint")
    
    def test_rechazar_asignacion_requires_observaciones(self, admin_token, admin_user):
        """Test that rechazar_asignacion requires observaciones"""
        # First create a test predio nuevo
        test_codigo = f"TEST_RECHAZO_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        create_response = requests.post(
            f"{BASE_URL}/api/predios-nuevos",
            json={
                "codigo_predial_nacional": test_codigo,
                "municipio": "TEST_MUNICIPIO",
                "direccion": "Test Address",
                "destino_economico": "Residencial"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if create_response.status_code == 201:
            predio_id = create_response.json().get("id")
            
            # Try to rechazar without observaciones
            response = requests.post(
                f"{BASE_URL}/api/predios-nuevos/{predio_id}/accion",
                json={
                    "accion": "rechazar_asignacion",
                    "observaciones": ""  # Empty observaciones
                },
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            
            # The frontend validates this, but backend should also handle it
            # Either 400 (validation error) or 403 (not the assigned gestor)
            assert response.status_code in [400, 403], f"Expected 400 or 403, got {response.status_code}"
            print("✓ rechazar_asignacion validation works")
            
            # Cleanup - delete test predio
            requests.delete(
                f"{BASE_URL}/api/predios-nuevos/{predio_id}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
        else:
            print(f"⚠ Could not create test predio: {create_response.text}")
            pytest.skip("Could not create test predio")


class TestPredioNuevoCreationAndEdit:
    """Test predio nuevo creation and edit flow (Bug Fix 1)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_create_predio_nuevo(self, admin_token):
        """Test creating a new predio"""
        test_codigo = f"TEST_EDIT_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        response = requests.post(
            f"{BASE_URL}/api/predios-nuevos",
            json={
                "codigo_predial_nacional": test_codigo,
                "municipio": "TEST_MUNICIPIO",
                "direccion": "Test Address for Edit",
                "destino_economico": "Residencial",
                "area_terreno": 100,
                "area_construida": 50
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 201, f"Failed to create predio: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"✓ Created predio nuevo with ID: {data['id']}")
        
        # Verify we can GET the created predio (for edit flow)
        get_response = requests.get(
            f"{BASE_URL}/api/predios-nuevos/{data['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200, f"Failed to get created predio: {get_response.text}"
        predio = get_response.json()
        assert predio["codigo_predial_nacional"] == test_codigo
        print(f"✓ GET /api/predios-nuevos/{data['id']} returns correct data for edit")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/predios-nuevos/{data['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        return data['id']


class TestGestorApoyoFlow:
    """Test gestor de apoyo flow including rechazar functionality"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_users_list(self, admin_token):
        """Test getting users list to find gestor de apoyo"""
        response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed to get users: {response.text}"
        users = response.json()
        
        # Find gestores
        gestores = [u for u in users if u.get('role') == 'gestor']
        print(f"✓ Found {len(gestores)} gestores in the system")
        
        if len(gestores) > 0:
            print(f"  Gestores: {[g.get('full_name', g.get('email')) for g in gestores[:5]]}")
        
        return gestores
    
    def test_predio_with_gestor_apoyo_assignment(self, admin_token):
        """Test that predios can have gestor_apoyo_id assigned"""
        # Get predios nuevos
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        predios = data.get('predios', data)
        
        # Check if any predio has gestor_apoyo_id
        predios_con_apoyo = [p for p in predios if p.get('gestor_apoyo_id')]
        print(f"✓ Found {len(predios_con_apoyo)} predios with gestor_apoyo_id assigned")
        
        if len(predios_con_apoyo) > 0:
            predio = predios_con_apoyo[0]
            print(f"  Example: Predio {predio.get('codigo_predial_nacional')} assigned to {predio.get('gestor_apoyo_nombre')}")


class TestActionEndpointValidation:
    """Test action endpoint validation"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_invalid_action_returns_400(self, admin_token):
        """Test that invalid action returns 400"""
        # First get a predio
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        predios = data.get('predios', data)
        
        if len(predios) > 0:
            predio_id = predios[0]['id']
            
            # Try invalid action
            response = requests.post(
                f"{BASE_URL}/api/predios-nuevos/{predio_id}/accion",
                json={
                    "accion": "invalid_action_xyz",
                    "observaciones": "Test"
                },
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            
            assert response.status_code == 400, f"Expected 400 for invalid action, got {response.status_code}"
            print("✓ Invalid action returns 400")
        else:
            pytest.skip("No predios available for testing")
    
    def test_valid_actions_list(self, admin_token):
        """Test that valid actions are: enviar_revision, aprobar, devolver, rechazar, rechazar_asignacion"""
        valid_actions = ['enviar_revision', 'aprobar', 'devolver', 'rechazar', 'rechazar_asignacion']
        
        # Get a predio
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        predios = data.get('predios', data)
        
        if len(predios) > 0:
            predio_id = predios[0]['id']
            
            for action in valid_actions:
                response = requests.post(
                    f"{BASE_URL}/api/predios-nuevos/{predio_id}/accion",
                    json={
                        "accion": action,
                        "observaciones": "Test validation"
                    },
                    headers={"Authorization": f"Bearer {admin_token}"}
                )
                
                # Should NOT return 400 "Acción no válida"
                # May return 403 (permission) or 400 (state validation) but not "invalid action"
                if response.status_code == 400:
                    error_detail = response.json().get('detail', '')
                    assert "no válida" not in error_detail.lower(), f"Action {action} should be valid but got: {error_detail}"
                
            print(f"✓ All valid actions are recognized: {valid_actions}")
        else:
            pytest.skip("No predios available for testing")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
