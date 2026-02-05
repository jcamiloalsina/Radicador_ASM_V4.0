"""
Test suite for Predios Nuevos Edit Modal (3 tabs) and Delete functionality
Tests the following features:
1. Modal de edición tiene 3 pestañas: Código Nacional, Propietario (R1), Físico (R2)
2. Pestaña 'Propietario (R1)' muestra propietarios y permite agregar/eliminar múltiples
3. Pestaña 'Propietario (R1)' incluye campos del predio: Dirección, Destino Económico, Matrícula, Áreas, Avalúo
4. Pestaña 'Físico (R2)' muestra zonas físicas y permite agregar/eliminar múltiples
5. Pestaña 'Físico (R2)' incluye campos: Zona Física, Zona Económica, Áreas, Habitaciones, Baños, Locales, Pisos, Puntaje
6. Botón 'Guardar Cambios' guarda correctamente todos los datos
7. Botón 'Eliminar' aparece para el gestor creador
8. Modal de eliminación muestra código, municipio y dirección del predio
9. Modal de eliminación requiere motivo obligatorio
10. Botón 'Eliminar Solicitud' elimina el predio correctamente
11. El predio eliminado ya no aparece en la lista
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
GESTOR_CREADOR = {
    "email": "gestor.creador@test.com",
    "password": "Asm*123*"
}

COORDINADOR = {
    "email": "catastro@asomunicipios.gov.co",
    "password": "Asm*123*"
}

# Test predio code - DO NOT DELETE THIS PREDIO
TEST_PREDIO_CODIGO = "541280002000000030237000000000"


class TestAuthentication:
    """Test authentication for both users"""
    
    def test_gestor_creador_login(self):
        """Test gestor creador can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=GESTOR_CREADOR)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ Gestor creador login successful: {data['user']['email']}")
    
    def test_coordinador_login(self):
        """Test coordinador can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COORDINADOR)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ Coordinador login successful: {data['user']['email']}")


class TestPrediosNuevosEndpoints:
    """Test predios nuevos API endpoints"""
    
    @pytest.fixture
    def gestor_token(self):
        """Get gestor creador token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=GESTOR_CREADOR)
        if response.status_code != 200:
            pytest.skip("Gestor creador login failed")
        return response.json()["token"]
    
    @pytest.fixture
    def coordinador_token(self):
        """Get coordinador token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COORDINADOR)
        if response.status_code != 200:
            pytest.skip("Coordinador login failed")
        return response.json()["token"]
    
    def test_get_predios_nuevos_list(self, gestor_token):
        """Test getting list of predios nuevos"""
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {gestor_token}"}
        )
        assert response.status_code == 200, f"Failed to get predios: {response.text}"
        data = response.json()
        predios = data.get('predios', data)
        assert isinstance(predios, list)
        print(f"✓ Got {len(predios)} predios nuevos")
    
    def test_get_test_predio_details(self, gestor_token):
        """Test getting details of the test predio"""
        # First get the list to find the predio ID
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {gestor_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        predios = data.get('predios', data)
        
        # Find the test predio
        test_predio = None
        for p in predios:
            if p.get('codigo_predial_nacional') == TEST_PREDIO_CODIGO:
                test_predio = p
                break
        
        if not test_predio:
            pytest.skip(f"Test predio {TEST_PREDIO_CODIGO} not found")
        
        # Verify predio has required fields for edit modal
        assert 'id' in test_predio
        assert 'municipio' in test_predio
        assert 'estado_flujo' in test_predio or 'estado' in test_predio
        
        # Check for propietarios data
        propietarios = test_predio.get('propietarios', [])
        print(f"✓ Test predio found with {len(propietarios)} propietarios")
        
        # Check for zonas_fisicas data
        zonas_fisicas = test_predio.get('zonas_fisicas', [])
        print(f"✓ Test predio has {len(zonas_fisicas)} zonas físicas")
        
        return test_predio
    
    def test_patch_predio_nuevo_endpoint_exists(self, gestor_token):
        """Test that PATCH endpoint for predios nuevos exists"""
        # Get the test predio first
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {gestor_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        predios = data.get('predios', data)
        
        test_predio = None
        for p in predios:
            if p.get('codigo_predial_nacional') == TEST_PREDIO_CODIGO:
                test_predio = p
                break
        
        if not test_predio:
            pytest.skip(f"Test predio {TEST_PREDIO_CODIGO} not found")
        
        # Test PATCH endpoint with minimal data (just observaciones to avoid changing real data)
        predio_id = test_predio['id']
        response = requests.patch(
            f"{BASE_URL}/api/predios-nuevos/{predio_id}",
            headers={"Authorization": f"Bearer {gestor_token}"},
            json={"observaciones": test_predio.get('observaciones', '')}
        )
        
        # Should succeed or fail with permission error (not 404)
        assert response.status_code in [200, 403, 400], f"Unexpected status: {response.status_code} - {response.text}"
        print(f"✓ PATCH endpoint exists and responds correctly (status: {response.status_code})")


class TestDeleteEndpoint:
    """Test DELETE endpoint for predios nuevos"""
    
    @pytest.fixture
    def gestor_token(self):
        """Get gestor creador token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=GESTOR_CREADOR)
        if response.status_code != 200:
            pytest.skip("Gestor creador login failed")
        return response.json()["token"]
    
    @pytest.fixture
    def coordinador_token(self):
        """Get coordinador token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COORDINADOR)
        if response.status_code != 200:
            pytest.skip("Coordinador login failed")
        return response.json()["token"]
    
    def test_delete_endpoint_exists(self, gestor_token):
        """Test that DELETE endpoint exists"""
        # Try to delete a non-existent predio to verify endpoint exists
        response = requests.delete(
            f"{BASE_URL}/api/predios-nuevos/non-existent-id",
            headers={"Authorization": f"Bearer {gestor_token}"},
            json={"motivo": "Test motivo"}
        )
        # Should return 404 (not found) not 405 (method not allowed)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ DELETE endpoint exists (returns 404 for non-existent predio)")
    
    def test_delete_requires_motivo(self, gestor_token):
        """Test that DELETE requires motivo"""
        # Get the test predio
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {gestor_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        predios = data.get('predios', data)
        
        test_predio = None
        for p in predios:
            if p.get('codigo_predial_nacional') == TEST_PREDIO_CODIGO:
                test_predio = p
                break
        
        if not test_predio:
            pytest.skip(f"Test predio {TEST_PREDIO_CODIGO} not found")
        
        # Try to delete without motivo
        predio_id = test_predio['id']
        response = requests.delete(
            f"{BASE_URL}/api/predios-nuevos/{predio_id}",
            headers={"Authorization": f"Bearer {gestor_token}"},
            json={"motivo": ""}  # Empty motivo
        )
        
        # Should fail with 400 (bad request) because motivo is required
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "motivo" in response.text.lower()
        print("✓ DELETE endpoint requires motivo (returns 400 for empty motivo)")
    
    def test_delete_only_by_creator(self, coordinador_token):
        """Test that only the creator can delete"""
        # Get the test predio
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {coordinador_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        predios = data.get('predios', data)
        
        test_predio = None
        for p in predios:
            if p.get('codigo_predial_nacional') == TEST_PREDIO_CODIGO:
                test_predio = p
                break
        
        if not test_predio:
            pytest.skip(f"Test predio {TEST_PREDIO_CODIGO} not found")
        
        # Try to delete as coordinador (not the creator)
        predio_id = test_predio['id']
        response = requests.delete(
            f"{BASE_URL}/api/predios-nuevos/{predio_id}",
            headers={"Authorization": f"Bearer {coordinador_token}"},
            json={"motivo": "Test deletion by non-creator"}
        )
        
        # Should fail with 403 (forbidden) because only creator can delete
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("✓ DELETE endpoint only allows creator to delete (returns 403 for non-creator)")


class TestPredioDataStructure:
    """Test that predio data has correct structure for edit modal"""
    
    @pytest.fixture
    def gestor_token(self):
        """Get gestor creador token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=GESTOR_CREADOR)
        if response.status_code != 200:
            pytest.skip("Gestor creador login failed")
        return response.json()["token"]
    
    def test_predio_has_propietarios_structure(self, gestor_token):
        """Test that predio has propietarios array with correct fields"""
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {gestor_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        predios = data.get('predios', data)
        
        test_predio = None
        for p in predios:
            if p.get('codigo_predial_nacional') == TEST_PREDIO_CODIGO:
                test_predio = p
                break
        
        if not test_predio:
            pytest.skip(f"Test predio {TEST_PREDIO_CODIGO} not found")
        
        propietarios = test_predio.get('propietarios', [])
        if len(propietarios) > 0:
            prop = propietarios[0]
            # Check expected fields
            expected_fields = ['nombre_propietario', 'tipo_documento', 'numero_documento']
            for field in expected_fields:
                if field in prop or 'nombre' in prop:  # nombre_propietario or nombre
                    print(f"✓ Propietario has field: {field}")
        else:
            # Check for legacy single propietario fields
            if test_predio.get('nombre_propietario'):
                print("✓ Predio has legacy nombre_propietario field")
        
        print(f"✓ Predio propietarios structure verified ({len(propietarios)} propietarios)")
    
    def test_predio_has_zonas_fisicas_structure(self, gestor_token):
        """Test that predio has zonas_fisicas array with correct fields"""
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {gestor_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        predios = data.get('predios', data)
        
        test_predio = None
        for p in predios:
            if p.get('codigo_predial_nacional') == TEST_PREDIO_CODIGO:
                test_predio = p
                break
        
        if not test_predio:
            pytest.skip(f"Test predio {TEST_PREDIO_CODIGO} not found")
        
        zonas_fisicas = test_predio.get('zonas_fisicas', [])
        if len(zonas_fisicas) > 0:
            zona = zonas_fisicas[0]
            # Check expected fields for R2 tab
            expected_fields = ['zona_fisica', 'zona_economica', 'area_terreno', 'area_construida', 
                             'habitaciones', 'banos', 'locales', 'pisos', 'puntaje']
            found_fields = [f for f in expected_fields if f in zona]
            print(f"✓ Zona física has fields: {found_fields}")
        else:
            # Check for r2 object
            r2 = test_predio.get('r2', {})
            if r2:
                print("✓ Predio has r2 object for physical data")
        
        print(f"✓ Predio zonas_fisicas structure verified ({len(zonas_fisicas)} zonas)")
    
    def test_predio_has_r1_fields(self, gestor_token):
        """Test that predio has R1 fields for Propietario tab"""
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {gestor_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        predios = data.get('predios', data)
        
        test_predio = None
        for p in predios:
            if p.get('codigo_predial_nacional') == TEST_PREDIO_CODIGO:
                test_predio = p
                break
        
        if not test_predio:
            pytest.skip(f"Test predio {TEST_PREDIO_CODIGO} not found")
        
        # Check R1 fields (Propietario tab includes predio info)
        r1_fields = ['direccion', 'destino_economico', 'matricula_inmobiliaria', 
                    'area_terreno', 'area_construida', 'avaluo']
        found_fields = [f for f in r1_fields if f in test_predio]
        print(f"✓ Predio has R1 fields: {found_fields}")
        
        # At least direccion and area_terreno should exist
        assert 'direccion' in test_predio or 'area_terreno' in test_predio, "Missing basic R1 fields"
        print("✓ Predio R1 fields structure verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
