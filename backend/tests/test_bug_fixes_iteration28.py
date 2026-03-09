"""
Test Bug Fixes for Iteration 28
================================
Bug 1: Gestor can view details of petitions they created
Bug 2: 'Ver / Editar' flow for new predios assigned from 'Mis Asignaciones'

Test credentials:
- Gestor de Apoyo: ninoatuesta@hotmail.com / Asm*123* (Marcelino Contreras Atuesta)
- Administrador: catastro@asomunicipios.gov.co / Asm*123*
- Gestor: jenniffer.lara@gmail.com / Asm*123* (not working - using another gestor)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://firma-resolucion.preview.emergentagent.com').rstrip('/')


class TestBugFixes:
    """Test bug fixes for iteration 28"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "catastro@asomunicipios.gov.co",
            "password": "Asm*123*"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        return data["token"]
    
    @pytest.fixture(scope="class")
    def admin_user(self):
        """Get admin user info"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "catastro@asomunicipios.gov.co",
            "password": "Asm*123*"
        })
        assert response.status_code == 200
        return response.json()["user"]
    
    @pytest.fixture(scope="class")
    def marcelino_token(self):
        """Get Marcelino (gestor de apoyo) authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ninoatuesta@hotmail.com",
            "password": "Asm*123*"
        })
        assert response.status_code == 200, f"Marcelino login failed: {response.text}"
        data = response.json()
        return data["token"]
    
    @pytest.fixture(scope="class")
    def marcelino_user(self):
        """Get Marcelino user info"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ninoatuesta@hotmail.com",
            "password": "Asm*123*"
        })
        assert response.status_code == 200
        return response.json()["user"]
    
    # ==================== BUG 1 TESTS ====================
    # Gestor can view details of petitions they created
    
    def test_bug1_gestor_creates_petition(self, marcelino_token, marcelino_user):
        """Bug 1: Gestor creates a petition and should be able to view its details"""
        # Create a petition as Marcelino (gestor)
        unique_id = str(uuid.uuid4())[:8]
        
        response = requests.post(
            f"{BASE_URL}/api/petitions",
            headers={"Authorization": f"Bearer {marcelino_token}"},
            data={
                "nombre_completo": f"TEST_Bug1_Peticion_{unique_id}",
                "correo": f"test_bug1_{unique_id}@test.com",
                "telefono": "3001234567",
                "tipo_tramite": "Certificado Catastral",
                "municipio": "Ábrego",
                "descripcion": "Test petition created by gestor for bug 1 verification"
            }
        )
        
        assert response.status_code == 200, f"Failed to create petition: {response.text}"
        petition = response.json()
        petition_id = petition["id"]
        
        # Verify the petition was created with user_id = marcelino's id
        assert petition["user_id"] == marcelino_user["id"], "Petition user_id should match creator"
        
        # Now try to get the petition details - this is the bug fix test
        response = requests.get(
            f"{BASE_URL}/api/petitions/{petition_id}",
            headers={"Authorization": f"Bearer {marcelino_token}"}
        )
        
        assert response.status_code == 200, f"Bug 1 FAILED: Gestor cannot view petition they created. Status: {response.status_code}, Response: {response.text}"
        
        petition_details = response.json()
        assert petition_details["id"] == petition_id
        assert petition_details["user_id"] == marcelino_user["id"]
        
        print(f"✓ Bug 1 PASSED: Gestor can view petition {petition_id} they created")
        
        return petition_id
    
    def test_bug1_gestor_cannot_view_others_petition(self, marcelino_token, admin_token):
        """Bug 1: Gestor should NOT be able to view petitions created by others (unless assigned)"""
        # Create a petition as admin
        unique_id = str(uuid.uuid4())[:8]
        
        response = requests.post(
            f"{BASE_URL}/api/petitions",
            headers={"Authorization": f"Bearer {admin_token}"},
            data={
                "nombre_completo": f"TEST_Bug1_AdminPeticion_{unique_id}",
                "correo": f"test_admin_{unique_id}@test.com",
                "telefono": "3009876543",
                "tipo_tramite": "Rectificaciones",
                "municipio": "Convención",
                "descripcion": "Test petition created by admin"
            }
        )
        
        assert response.status_code == 200, f"Failed to create admin petition: {response.text}"
        petition = response.json()
        petition_id = petition["id"]
        
        # Marcelino should NOT be able to view this petition (not assigned, not creator)
        response = requests.get(
            f"{BASE_URL}/api/petitions/{petition_id}",
            headers={"Authorization": f"Bearer {marcelino_token}"}
        )
        
        # Should get 403 Forbidden
        assert response.status_code == 403, f"Bug 1 security check: Gestor should NOT view others' petitions. Got status {response.status_code}"
        
        print(f"✓ Bug 1 security PASSED: Gestor correctly denied access to petition {petition_id}")
    
    def test_bug1_gestor_can_view_assigned_petition(self, marcelino_token, marcelino_user, admin_token):
        """Bug 1: Gestor can view petitions assigned to them"""
        # Create a petition as admin
        unique_id = str(uuid.uuid4())[:8]
        
        response = requests.post(
            f"{BASE_URL}/api/petitions",
            headers={"Authorization": f"Bearer {admin_token}"},
            data={
                "nombre_completo": f"TEST_Bug1_Assigned_{unique_id}",
                "correo": f"test_assigned_{unique_id}@test.com",
                "telefono": "3005555555",
                "tipo_tramite": "Mutaciones",
                "municipio": "El Carmen",
                "descripcion": "Test petition to be assigned to gestor"
            }
        )
        
        assert response.status_code == 200
        petition = response.json()
        petition_id = petition["id"]
        
        # Assign the petition to Marcelino
        response = requests.post(
            f"{BASE_URL}/api/petitions/{petition_id}/asignar/{marcelino_user['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Failed to assign petition: {response.text}"
        
        # Now Marcelino should be able to view it
        response = requests.get(
            f"{BASE_URL}/api/petitions/{petition_id}",
            headers={"Authorization": f"Bearer {marcelino_token}"}
        )
        
        assert response.status_code == 200, f"Gestor should view assigned petition. Status: {response.status_code}"
        
        print(f"✓ Bug 1 assigned PASSED: Gestor can view assigned petition {petition_id}")
    
    # ==================== BUG 2 TESTS ====================
    # 'Ver / Editar' flow for new predios assigned from 'Mis Asignaciones'
    
    def test_bug2_get_predios_nuevos_assigned_to_marcelino(self, marcelino_token, marcelino_user):
        """Bug 2: Get predios nuevos assigned to Marcelino"""
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {marcelino_token}"}
        )
        
        assert response.status_code == 200, f"Failed to get predios nuevos: {response.text}"
        
        data = response.json()
        predios = data.get("predios", [])
        
        # Filter predios assigned to Marcelino
        assigned_predios = [p for p in predios if p.get("gestor_apoyo_id") == marcelino_user["id"]]
        
        print(f"Found {len(assigned_predios)} predios nuevos assigned to Marcelino")
        
        for p in assigned_predios:
            print(f"  - ID: {p['id']}, Estado: {p.get('estado_flujo', 'N/A')}, Municipio: {p.get('municipio', 'N/A')}")
        
        return assigned_predios
    
    def test_bug2_get_single_predio_nuevo(self, marcelino_token, marcelino_user):
        """Bug 2: Get a single predio nuevo by ID (simulates the API call when navigating to /dashboard/predios?predio_nuevo={id})"""
        # First get the list of predios nuevos
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {marcelino_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        predios = data.get("predios", [])
        
        # Find a predio assigned to Marcelino in editable state
        assigned_predios = [
            p for p in predios 
            if p.get("gestor_apoyo_id") == marcelino_user["id"] 
            and p.get("estado_flujo") in ["creado", "digitalizacion", "devuelto"]
        ]
        
        if not assigned_predios:
            # If no editable predios, check for any assigned
            assigned_predios = [p for p in predios if p.get("gestor_apoyo_id") == marcelino_user["id"]]
        
        if not assigned_predios:
            pytest.skip("No predios nuevos assigned to Marcelino for testing")
        
        predio = assigned_predios[0]
        predio_id = predio["id"]
        
        # Get the single predio nuevo - this is what the frontend does when navigating
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos/{predio_id}",
            headers={"Authorization": f"Bearer {marcelino_token}"}
        )
        
        assert response.status_code == 200, f"Bug 2 FAILED: Cannot get predio nuevo {predio_id}. Status: {response.status_code}, Response: {response.text}"
        
        predio_data = response.json()
        
        # Verify the data is complete for editing
        assert "id" in predio_data
        assert "municipio" in predio_data
        assert "codigo_predial_nacional" in predio_data or predio_data.get("codigo_predial_nacional") is None
        
        print(f"✓ Bug 2 API PASSED: Can get predio nuevo {predio_id} for editing")
        print(f"  - Municipio: {predio_data.get('municipio')}")
        print(f"  - Estado: {predio_data.get('estado_flujo')}")
        print(f"  - Código: {predio_data.get('codigo_predial_nacional', 'N/A')}")
        
        return predio_id
    
    def test_bug2_create_predio_nuevo_for_marcelino(self, admin_token, marcelino_user):
        """Bug 2: Create a new predio nuevo assigned to Marcelino for testing the edit flow"""
        unique_id = str(uuid.uuid4())[:8]
        
        # Create a predio nuevo assigned to Marcelino
        predio_data = {
            "r1": {
                "municipio": "San Calixto",
                "zona": "00",
                "sector": "01",
                "comuna": "00",
                "barrio": "00",
                "manzana_vereda": "0001",
                "terreno": f"{int(unique_id[:4], 16) % 9999:04d}",
                "condicion_predio": "0000",
                "predio_horizontal": "000000000",
                "nombre_propietario": f"TEST_Bug2_Propietario_{unique_id}",
                "tipo_documento": "C",
                "numero_documento": f"1234{unique_id[:4]}",
                "direccion": f"VEREDA TEST BUG 2 - {unique_id}",
                "destino_economico": "A",
                "area_terreno": 1000.0,
                "area_construida": 50.0,
                "avaluo": 5000000.0
            },
            "gestor_apoyo_id": marcelino_user["id"],
            "observaciones": f"Test predio for Bug 2 verification - {unique_id}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/predios-nuevos",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json=predio_data
        )
        
        assert response.status_code in [200, 201], f"Failed to create predio nuevo: {response.text}"
        
        predio = response.json()
        predio_id = predio["id"]
        
        # Verify it's assigned to Marcelino
        assert predio.get("gestor_apoyo_id") == marcelino_user["id"], "Predio should be assigned to Marcelino"
        
        print(f"✓ Created test predio nuevo {predio_id} assigned to Marcelino")
        
        return predio_id
    
    def test_bug2_marcelino_can_access_assigned_predio(self, marcelino_token, admin_token, marcelino_user):
        """Bug 2: Verify Marcelino can access a predio nuevo assigned to him"""
        # First create a predio assigned to Marcelino
        unique_id = str(uuid.uuid4())[:8]
        
        predio_data = {
            "r1": {
                "municipio": "San Calixto",
                "zona": "00",
                "sector": "01",
                "comuna": "00",
                "barrio": "00",
                "manzana_vereda": "0002",
                "terreno": f"{int(unique_id[:4], 16) % 9999:04d}",
                "condicion_predio": "0000",
                "predio_horizontal": "000000000",
                "nombre_propietario": f"TEST_Bug2_Access_{unique_id}",
                "tipo_documento": "C",
                "numero_documento": f"5678{unique_id[:4]}",
                "direccion": f"VEREDA TEST ACCESS - {unique_id}",
                "destino_economico": "D",
                "area_terreno": 2000.0,
                "area_construida": 100.0,
                "avaluo": 10000000.0
            },
            "gestor_apoyo_id": marcelino_user["id"],
            "observaciones": f"Test access verification - {unique_id}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/predios-nuevos",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json=predio_data
        )
        
        assert response.status_code in [200, 201], f"Failed to create predio: {response.text}"
        predio = response.json()
        predio_id = predio["id"]
        
        # Now Marcelino should be able to access it
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos/{predio_id}",
            headers={"Authorization": f"Bearer {marcelino_token}"}
        )
        
        assert response.status_code == 200, f"Bug 2 FAILED: Marcelino cannot access assigned predio. Status: {response.status_code}"
        
        predio_data = response.json()
        
        # Verify all required fields for editing are present
        required_fields = ["id", "municipio", "direccion", "area_terreno", "gestor_apoyo_id"]
        for field in required_fields:
            assert field in predio_data, f"Missing required field: {field}"
        
        print(f"✓ Bug 2 access PASSED: Marcelino can access predio {predio_id}")
        print(f"  - All required fields present for editing")
        
        return predio_id


class TestPrediosNuevosEndpoint:
    """Additional tests for predios-nuevos endpoint"""
    
    @pytest.fixture(scope="class")
    def marcelino_token(self):
        """Get Marcelino authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ninoatuesta@hotmail.com",
            "password": "Asm*123*"
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_predios_nuevos_list_endpoint(self, marcelino_token):
        """Test that predios-nuevos list endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {marcelino_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "predios" in data
        
        print(f"✓ Predios nuevos endpoint returns {len(data['predios'])} predios")
    
    def test_predios_nuevos_single_endpoint(self, marcelino_token):
        """Test that single predio nuevo endpoint works"""
        # Get list first
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {marcelino_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        predios = data.get("predios", [])
        
        if not predios:
            pytest.skip("No predios nuevos available for testing")
        
        predio_id = predios[0]["id"]
        
        # Get single predio
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos/{predio_id}",
            headers={"Authorization": f"Bearer {marcelino_token}"}
        )
        
        assert response.status_code == 200
        predio = response.json()
        assert predio["id"] == predio_id
        
        print(f"✓ Single predio nuevo endpoint works for {predio_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
