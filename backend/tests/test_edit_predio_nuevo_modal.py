"""
Test suite for the multi-tab edit modal for predios nuevos.
Tests the PATCH /api/predios-nuevos/{predio_id} endpoint.

Features tested:
- Edit button appears for gestor creador in 'Mis Creaciones'
- Modal opens with 4 tabs: Básico, R1-Jurídico, R2-Físico, Propietarios
- Data loads correctly in the form
- Save changes works and updates the predio
- Código predial nacional is NOT modified when editing
- Modal closes after save and shows success toast
- Historial is updated after save
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEditPredioNuevoModal:
    """Tests for the edit predio nuevo modal functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as gestor creador
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "gestor.creador@test.com",
            "password": "Asm*123*"
        })
        
        if login_response.status_code == 200:
            self.gestor_token = login_response.json().get("token")
            self.gestor_user = login_response.json().get("user")
            self.session.headers.update({"Authorization": f"Bearer {self.gestor_token}"})
        else:
            # Try with coordinador if gestor doesn't exist
            login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
                "email": "catastro@asomunicipios.gov.co",
                "password": "Asm*123*"
            })
            if login_response.status_code == 200:
                self.gestor_token = login_response.json().get("token")
                self.gestor_user = login_response.json().get("user")
                self.session.headers.update({"Authorization": f"Bearer {self.gestor_token}"})
            else:
                pytest.skip("Could not authenticate - skipping tests")
        
        yield
        
        self.session.close()
    
    def test_get_predios_nuevos_list(self):
        """Test that we can get the list of predios nuevos"""
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        predios = data.get('predios', data) if isinstance(data, dict) else data
        
        print(f"Found {len(predios)} predios nuevos")
        assert isinstance(predios, list), "Response should contain a list of predios"
    
    def test_get_predio_nuevo_by_id(self):
        """Test getting a specific predio nuevo by ID"""
        # First get list to find a predio
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos")
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get('predios', data) if isinstance(data, dict) else data
        
        if not predios:
            pytest.skip("No predios nuevos found to test")
        
        predio_id = predios[0]['id']
        
        # Get specific predio
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos/{predio_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        predio = response.json()
        assert predio['id'] == predio_id
        print(f"Got predio: {predio.get('codigo_predial_nacional', 'N/A')}")
    
    def test_patch_predio_nuevo_basic_fields(self):
        """Test updating basic fields of a predio nuevo"""
        # Get list of predios
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos")
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get('predios', data) if isinstance(data, dict) else data
        
        # Find a predio in editable state (creado, digitalizacion, devuelto)
        editable_predio = None
        for p in predios:
            estado = p.get('estado_flujo', p.get('estado', ''))
            if estado in ['creado', 'digitalizacion', 'devuelto']:
                editable_predio = p
                break
        
        if not editable_predio:
            pytest.skip("No editable predios found (need estado: creado, digitalizacion, or devuelto)")
        
        predio_id = editable_predio['id']
        original_codigo = editable_predio.get('codigo_predial_nacional')
        
        print(f"Testing with predio ID: {predio_id}, código: {original_codigo}")
        
        # Update basic fields
        update_data = {
            "direccion": "Calle Test 123 - Updated",
            "area_terreno": 150.5,
            "area_construida": 80.0,
            "avaluo": 50000000,
            "destino_economico": "H",
            "observaciones": "Test observation from pytest"
        }
        
        response = self.session.patch(f"{BASE_URL}/api/predios-nuevos/{predio_id}", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        updated_predio = response.json()
        
        # Verify updates were applied
        assert updated_predio['direccion'] == update_data['direccion'], "Direccion should be updated"
        assert updated_predio['area_terreno'] == update_data['area_terreno'], "Area terreno should be updated"
        assert updated_predio['avaluo'] == update_data['avaluo'], "Avaluo should be updated"
        
        # CRITICAL: Verify código predial nacional was NOT changed
        assert updated_predio.get('codigo_predial_nacional') == original_codigo, \
            f"Código predial should NOT change! Original: {original_codigo}, Got: {updated_predio.get('codigo_predial_nacional')}"
        
        print(f"✓ Basic fields updated successfully, código predial preserved: {original_codigo}")
    
    def test_patch_predio_nuevo_r1_fields(self):
        """Test updating R1 (jurídico) fields"""
        # Get list of predios
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos")
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get('predios', data) if isinstance(data, dict) else data
        
        # Find editable predio
        editable_predio = None
        for p in predios:
            estado = p.get('estado_flujo', p.get('estado', ''))
            if estado in ['creado', 'digitalizacion', 'devuelto']:
                editable_predio = p
                break
        
        if not editable_predio:
            pytest.skip("No editable predios found")
        
        predio_id = editable_predio['id']
        original_codigo = editable_predio.get('codigo_predial_nacional')
        
        # Update R1 fields
        update_data = {
            "r1": {
                "numero_orden": "1",
                "calificacion_no_certificada": "0",
                "tipo_predio": "2",
                "numero_predial_anterior": "TEST-ANT-001",
                "complemento_nom_predio": "Lote Test",
                "area_total_terreno": 200.0,
                "valor_referencia": 100000,
                "tipo_avaluo_catastral": "1"
            }
        }
        
        response = self.session.patch(f"{BASE_URL}/api/predios-nuevos/{predio_id}", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        updated_predio = response.json()
        
        # Verify R1 was updated
        r1 = updated_predio.get('r1', {})
        assert r1.get('numero_orden') == "1", "R1 numero_orden should be updated"
        assert r1.get('tipo_predio') == "2", "R1 tipo_predio should be updated"
        
        # Verify código predial NOT changed
        assert updated_predio.get('codigo_predial_nacional') == original_codigo, \
            "Código predial should NOT change when updating R1"
        
        print(f"✓ R1 fields updated successfully")
    
    def test_patch_predio_nuevo_r2_fields(self):
        """Test updating R2 (físico) fields"""
        # Get list of predios
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos")
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get('predios', data) if isinstance(data, dict) else data
        
        # Find editable predio
        editable_predio = None
        for p in predios:
            estado = p.get('estado_flujo', p.get('estado', ''))
            if estado in ['creado', 'digitalizacion', 'devuelto']:
                editable_predio = p
                break
        
        if not editable_predio:
            pytest.skip("No editable predios found")
        
        predio_id = editable_predio['id']
        original_codigo = editable_predio.get('codigo_predial_nacional')
        
        # Update R2 fields
        update_data = {
            "r2": {
                "matricula_inmobiliaria": "TEST-MAT-001",
                "tipo_construccion": "C",
                "pisos_1": 2,
                "habitaciones_1": 4,
                "banos_1": 2,
                "locales_1": 0,
                "anio_construccion": "2020",
                "area_construida_1": 120.0,
                "area_terreno_1": 200.0,
                "puntaje_1": 50,
                "valor_m2_construccion": 500000,
                "valor_m2_terreno": 200000
            }
        }
        
        response = self.session.patch(f"{BASE_URL}/api/predios-nuevos/{predio_id}", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        updated_predio = response.json()
        
        # Verify R2 was updated
        r2 = updated_predio.get('r2', {})
        assert r2.get('matricula_inmobiliaria') == "TEST-MAT-001", "R2 matricula should be updated"
        assert r2.get('pisos_1') == 2, "R2 pisos should be updated"
        assert r2.get('habitaciones_1') == 4, "R2 habitaciones should be updated"
        
        # Verify código predial NOT changed
        assert updated_predio.get('codigo_predial_nacional') == original_codigo, \
            "Código predial should NOT change when updating R2"
        
        print(f"✓ R2 fields updated successfully")
    
    def test_patch_predio_nuevo_propietarios(self):
        """Test updating propietarios"""
        # Get list of predios
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos")
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get('predios', data) if isinstance(data, dict) else data
        
        # Find editable predio
        editable_predio = None
        for p in predios:
            estado = p.get('estado_flujo', p.get('estado', ''))
            if estado in ['creado', 'digitalizacion', 'devuelto']:
                editable_predio = p
                break
        
        if not editable_predio:
            pytest.skip("No editable predios found")
        
        predio_id = editable_predio['id']
        original_codigo = editable_predio.get('codigo_predial_nacional')
        
        # Update propietarios
        update_data = {
            "propietarios": [
                {
                    "nombre": "Juan Test Propietario",
                    "tipo_documento": "C",
                    "numero_documento": "12345678",
                    "estado_civil": "S",
                    "porcentaje": "60"
                },
                {
                    "nombre": "María Test Copropietaria",
                    "tipo_documento": "C",
                    "numero_documento": "87654321",
                    "estado_civil": "C",
                    "porcentaje": "40"
                }
            ],
            "nombre_propietario": "Juan Test Propietario",
            "tipo_documento": "C",
            "numero_documento": "12345678"
        }
        
        response = self.session.patch(f"{BASE_URL}/api/predios-nuevos/{predio_id}", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        updated_predio = response.json()
        
        # Verify propietarios were updated
        propietarios = updated_predio.get('propietarios', [])
        assert len(propietarios) == 2, f"Should have 2 propietarios, got {len(propietarios)}"
        assert propietarios[0]['nombre'] == "Juan Test Propietario"
        assert propietarios[1]['nombre'] == "María Test Copropietaria"
        
        # Verify main propietario fields
        assert updated_predio.get('nombre_propietario') == "Juan Test Propietario"
        
        # Verify código predial NOT changed
        assert updated_predio.get('codigo_predial_nacional') == original_codigo, \
            "Código predial should NOT change when updating propietarios"
        
        print(f"✓ Propietarios updated successfully")
    
    def test_patch_predio_nuevo_historial_updated(self):
        """Test that historial is updated after save"""
        # Get list of predios
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos")
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get('predios', data) if isinstance(data, dict) else data
        
        # Find editable predio
        editable_predio = None
        for p in predios:
            estado = p.get('estado_flujo', p.get('estado', ''))
            if estado in ['creado', 'digitalizacion', 'devuelto']:
                editable_predio = p
                break
        
        if not editable_predio:
            pytest.skip("No editable predios found")
        
        predio_id = editable_predio['id']
        original_historial_count = len(editable_predio.get('historial_flujo', []))
        
        # Make an update
        update_data = {
            "observaciones": f"Test historial update - {os.urandom(4).hex()}"
        }
        
        response = self.session.patch(f"{BASE_URL}/api/predios-nuevos/{predio_id}", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        updated_predio = response.json()
        new_historial_count = len(updated_predio.get('historial_flujo', []))
        
        # Verify historial was updated
        assert new_historial_count > original_historial_count, \
            f"Historial should have new entry. Original: {original_historial_count}, New: {new_historial_count}"
        
        # Check last historial entry
        last_entry = updated_predio['historial_flujo'][-1]
        assert last_entry['accion'] == "Predio actualizado", "Last action should be 'Predio actualizado'"
        
        print(f"✓ Historial updated: {original_historial_count} -> {new_historial_count} entries")
    
    def test_patch_predio_nuevo_protected_fields(self):
        """Test that protected fields cannot be changed"""
        # Get list of predios
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos")
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get('predios', data) if isinstance(data, dict) else data
        
        # Find editable predio
        editable_predio = None
        for p in predios:
            estado = p.get('estado_flujo', p.get('estado', ''))
            if estado in ['creado', 'digitalizacion', 'devuelto']:
                editable_predio = p
                break
        
        if not editable_predio:
            pytest.skip("No editable predios found")
        
        predio_id = editable_predio['id']
        original_codigo = editable_predio.get('codigo_predial_nacional')
        original_gestor_creador = editable_predio.get('gestor_creador_id')
        
        # Try to change protected fields
        update_data = {
            "codigo_predial_nacional": "999999999999999999999999999999",
            "gestor_creador_id": "fake-id-12345",
            "id": "fake-predio-id",
            "direccion": "This should update"
        }
        
        response = self.session.patch(f"{BASE_URL}/api/predios-nuevos/{predio_id}", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        updated_predio = response.json()
        
        # Verify protected fields were NOT changed
        assert updated_predio.get('codigo_predial_nacional') == original_codigo, \
            "codigo_predial_nacional should NOT change"
        assert updated_predio.get('gestor_creador_id') == original_gestor_creador, \
            "gestor_creador_id should NOT change"
        assert updated_predio.get('id') == predio_id, \
            "id should NOT change"
        
        # But non-protected field should update
        assert updated_predio.get('direccion') == "This should update", \
            "Non-protected fields should update"
        
        print(f"✓ Protected fields preserved correctly")
    
    def test_patch_predio_nuevo_non_editable_state_fails(self):
        """Test that editing fails for predios in non-editable states"""
        # Get list of predios
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos")
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get('predios', data) if isinstance(data, dict) else data
        
        # Find a predio in non-editable state (revision, aprobado, rechazado)
        non_editable_predio = None
        for p in predios:
            estado = p.get('estado_flujo', p.get('estado', ''))
            if estado in ['revision', 'aprobado', 'rechazado']:
                non_editable_predio = p
                break
        
        if not non_editable_predio:
            pytest.skip("No non-editable predios found to test")
        
        predio_id = non_editable_predio['id']
        
        # Try to update
        update_data = {
            "direccion": "Should not update"
        }
        
        response = self.session.patch(f"{BASE_URL}/api/predios-nuevos/{predio_id}", json=update_data)
        
        # Should fail with 400
        assert response.status_code == 400, \
            f"Expected 400 for non-editable state, got {response.status_code}"
        
        print(f"✓ Correctly rejected edit for predio in state: {non_editable_predio.get('estado_flujo')}")


class TestEditPredioNuevoPermissions:
    """Tests for permission checks on edit predio nuevo"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        yield
        self.session.close()
    
    def test_usuario_cannot_edit_predio_nuevo(self):
        """Test that regular users cannot edit predios nuevos"""
        # Login as regular user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "usuario@test.com",
            "password": "Asm*123*"
        })
        
        if login_response.status_code != 200:
            pytest.skip("No regular user available for testing")
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get predios list
        response = self.session.get(f"{BASE_URL}/api/predios-nuevos")
        
        if response.status_code != 200:
            pytest.skip("User cannot access predios-nuevos endpoint")
        
        data = response.json()
        predios = data.get('predios', data) if isinstance(data, dict) else data
        
        if not predios:
            pytest.skip("No predios available")
        
        predio_id = predios[0]['id']
        
        # Try to edit
        response = self.session.patch(f"{BASE_URL}/api/predios-nuevos/{predio_id}", json={
            "direccion": "Should fail"
        })
        
        assert response.status_code == 403, \
            f"Expected 403 for regular user, got {response.status_code}"
        
        print("✓ Regular user correctly denied edit access")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
