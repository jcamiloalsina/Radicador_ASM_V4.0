"""
Test suite for R2 Refactor - Iteration 34
Tests the catastral system with R2 refactor implementation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://land-registry-16.preview.emergentagent.com').rstrip('/')

# Test credentials
COORDINADOR_EMAIL = "Camilo.alsina1@hotmail.com"
COORDINADOR_PASSWORD = "Asm*123*"
ADMIN_EMAIL = "catastro@asomunicipios.gov.co"
ADMIN_PASSWORD = "Asm*123*"

class TestAuthentication:
    """Authentication tests"""
    
    def test_01_coordinador_login(self):
        """Test coordinador login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COORDINADOR_EMAIL,
            "password": COORDINADOR_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "coordinador"
        print(f"✅ Coordinador login successful: {data['user']['full_name']}")
    
    def test_02_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "administrador"
        print(f"✅ Admin login successful: {data['user']['full_name']}")


class TestPrediosAPI:
    """Predios API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COORDINADOR_EMAIL,
            "password": COORDINADOR_PASSWORD
        })
        return response.json()["token"]
    
    def test_03_get_predios_san_calixto(self, auth_token):
        """Test getting predios for San Calixto"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/predios?municipio=San Calixto&vigencia=2026&limit=10",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "predios" in data
        assert "total" in data
        print(f"✅ San Calixto predios: {data['total']} total, {len(data['predios'])} returned")
        
        # Verify predio structure has R2 fields
        if data['predios']:
            predio = data['predios'][0]
            assert "codigo_predial_nacional" in predio
            print(f"✅ First predio: {predio['codigo_predial_nacional']}")
    
    def test_04_verify_predio_r2_structure(self, auth_token):
        """Test that predios have the new R2 structure with zonas and construcciones"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/predios?municipio=San Calixto&vigencia=2026&limit=5",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        if data['predios']:
            predio = data['predios'][0]
            # Check for new R2 structure
            has_zonas = "zonas" in predio
            has_construcciones = "construcciones" in predio
            
            if has_zonas:
                print(f"✅ Predio has 'zonas' array: {len(predio.get('zonas', []))} zonas")
            if has_construcciones:
                print(f"✅ Predio has 'construcciones' array: {len(predio.get('construcciones', []))} construcciones")
            
            # Also check for legacy R2 field
            if "r2" in predio:
                print(f"ℹ️ Predio also has legacy 'r2' field")
    
    def test_05_get_catalogos(self, auth_token):
        """Test getting catalogos"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/predios/catalogos", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "destino_economico" in data
        print(f"✅ Catalogos loaded: {len(data.get('destino_economico', {}))} destinos económicos")
    
    def test_06_get_predios_stats_summary(self, auth_token):
        """Test getting predios stats summary"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/predios/stats/summary", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Predios stats summary: {data}")


class TestExcelExport:
    """Excel export tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COORDINADOR_EMAIL,
            "password": COORDINADOR_PASSWORD
        })
        return response.json()["token"]
    
    def test_07_export_excel_predios(self, auth_token):
        """Test Excel export for predios"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/predios/export-excel?municipio=San Calixto&vigencia=2026",
            headers=headers
        )
        assert response.status_code == 200
        assert 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in response.headers.get('content-type', '')
        print(f"✅ Excel export successful, size: {len(response.content)} bytes")
    
    def test_08_export_excel_tramites(self, auth_token):
        """Test Excel export for tramites"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/reports/tramites/export-excel",
            headers=headers
        )
        assert response.status_code == 200
        print(f"✅ Tramites Excel export successful, size: {len(response.content)} bytes")


class TestPetitionsAPI:
    """Petitions API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COORDINADOR_EMAIL,
            "password": COORDINADOR_PASSWORD
        })
        return response.json()["token"]
    
    def test_09_get_petitions(self, auth_token):
        """Test getting petitions"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/petitions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Petitions loaded: {len(data)} petitions")
    
    def test_10_get_gestores_disponibles(self, auth_token):
        """Test getting available gestores"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/users/gestores-disponibles", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Gestores disponibles: {len(data)}")
    
    def test_11_get_dashboard_stats(self, auth_token):
        """Test getting dashboard stats"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/petitions/stats/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Dashboard stats: {data.get('total_activos', 0)} active petitions")


class TestPrediosEliminados:
    """Predios eliminados tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COORDINADOR_EMAIL,
            "password": COORDINADOR_PASSWORD
        })
        return response.json()["token"]
    
    def test_12_get_predios_eliminados(self, auth_token):
        """Test getting eliminated predios"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/predios/eliminados", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Predios eliminados: {len(data.get('predios', data))} predios")
    
    def test_13_get_predios_eliminados_stats(self, auth_token):
        """Test getting eliminated predios stats"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/predios/eliminados/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Predios eliminados stats: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
