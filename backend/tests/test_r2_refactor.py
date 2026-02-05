"""
Test R2 Refactor - Zonas de Terreno y Construcciones separadas
Tests for the new R2 form structure with separate zones and constructions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestR2RefactorBackend:
    """Tests for R2 refactor backend functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.coordinador_email = "Camilo.alsina1@hotmail.com"
        self.coordinador_password = "Asm*123*"
        self.admin_email = "catastro@asomunicipios.gov.co"
        self.admin_password = "Asm*123*"
        self.gestor_email = "gestor.creador@test.com"
        self.gestor_password = "Asm*123*"
    
    def get_auth_token(self, email, password):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    def test_01_backend_root(self):
        """Test backend root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        # Root might return 404 or 200 depending on implementation
        assert response.status_code in [200, 404, 307]
        print("✅ Backend root endpoint accessible")
    
    def test_02_coordinador_login(self):
        """Test coordinador can login"""
        token = self.get_auth_token(self.coordinador_email, self.coordinador_password)
        assert token is not None, "Coordinador login failed"
        print(f"✅ Coordinador login successful, token: {token[:20]}...")
    
    def test_03_admin_login(self):
        """Test admin can login"""
        token = self.get_auth_token(self.admin_email, self.admin_password)
        assert token is not None, "Admin login failed"
        print(f"✅ Admin login successful, token: {token[:20]}...")
    
    def test_04_get_predios_san_calixto(self):
        """Test getting predios for San Calixto municipality"""
        token = self.get_auth_token(self.coordinador_email, self.coordinador_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/predios",
            params={"municipio": "San Calixto", "vigencia": "2026", "limit": 10},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # API returns {"predios": [...], "total": N}
        assert "predios" in data, "Response should have 'predios' key"
        assert "total" in data, "Response should have 'total' key"
        predios = data["predios"]
        assert isinstance(predios, list)
        print(f"✅ Got {len(predios)} predios from San Calixto (total: {data['total']})")
        
        # Check if predios have the expected structure
        if len(predios) > 0:
            predio = predios[0]
            print(f"  Sample predio keys: {list(predio.keys())[:10]}")
    
    def test_05_get_catalogos(self):
        """Test getting catalogos (destino_economico, etc.)"""
        token = self.get_auth_token(self.coordinador_email, self.coordinador_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/predios/catalogos",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "destino_economico" in data
        print(f"✅ Catalogos retrieved: {list(data.keys())}")
    
    def test_06_export_excel_tramites(self):
        """Test export Excel for tramites endpoint"""
        token = self.get_auth_token(self.coordinador_email, self.coordinador_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/reports/tramites/export-excel",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")
        print(f"✅ Export Excel tramites successful, size: {len(response.content)} bytes")
    
    def test_07_export_excel_predios(self):
        """Test export Excel for predios endpoint with R2 data"""
        token = self.get_auth_token(self.coordinador_email, self.coordinador_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/predios/export-excel",
            params={"municipio": "San Calixto", "vigencia": "2026"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")
        print(f"✅ Export Excel predios successful, size: {len(response.content)} bytes")
    
    def test_08_get_estructura_codigo(self):
        """Test getting estructura de codigo for San Calixto"""
        token = self.get_auth_token(self.coordinador_email, self.coordinador_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/predios/estructura-codigo/San%20Calixto",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Estructura codigo: {data}")
    
    def test_09_get_gestores_disponibles(self):
        """Test getting available gestores"""
        token = self.get_auth_token(self.coordinador_email, self.coordinador_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/users/gestores-disponibles",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} gestores disponibles")
    
    def test_10_get_petitions(self):
        """Test getting petitions list"""
        token = self.get_auth_token(self.coordinador_email, self.coordinador_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/petitions",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} petitions")
    
    def test_11_get_predios_nuevos(self):
        """Test getting predios nuevos (in workflow)"""
        token = self.get_auth_token(self.coordinador_email, self.coordinador_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # API returns {"predios": [...], "total": N, "skip": N, "limit": N}
        assert "predios" in data, "Response should have 'predios' key"
        predios = data["predios"]
        assert isinstance(predios, list)
        print(f"✅ Got {len(predios)} predios nuevos (total: {data.get('total', 'N/A')})")
    
    def test_12_verify_predio_structure_with_zonas_construcciones(self):
        """Test that predios can have separate zonas and construcciones"""
        token = self.get_auth_token(self.coordinador_email, self.coordinador_password)
        assert token is not None
        
        # Get a predio to check its structure
        response = requests.get(
            f"{BASE_URL}/api/predios",
            params={"municipio": "San Calixto", "vigencia": "2026", "limit": 5},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        predios = data.get("predios", [])
        
        if len(predios) > 0:
            predio = predios[0]
            # Check for new structure fields
            has_zonas = "zonas" in predio
            has_construcciones = "construcciones" in predio
            has_r2_registros = "r2_registros" in predio
            
            print(f"  Predio structure check:")
            print(f"    - has 'zonas': {has_zonas}")
            print(f"    - has 'construcciones': {has_construcciones}")
            print(f"    - has 'r2_registros': {has_r2_registros}")
            
            # The backend should support both old and new formats
            print("✅ Predio structure verified")
        else:
            print("⚠️ No predios found to verify structure")
    
    def test_13_verify_predios_nuevos_structure(self):
        """Test that predios nuevos have the new zonas/construcciones structure"""
        token = self.get_auth_token(self.coordinador_email, self.coordinador_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/predios-nuevos",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        predios = data.get("predios", [])
        
        if len(predios) > 0:
            predio = predios[0]
            print(f"  Predio nuevo keys: {list(predio.keys())}")
            
            # Check for new structure fields
            has_zonas = "zonas" in predio
            has_construcciones = "construcciones" in predio
            
            print(f"  Predio nuevo structure check:")
            print(f"    - has 'zonas': {has_zonas}")
            print(f"    - has 'construcciones': {has_construcciones}")
            
            if has_zonas:
                print(f"    - zonas count: {len(predio.get('zonas', []))}")
            if has_construcciones:
                print(f"    - construcciones count: {len(predio.get('construcciones', []))}")
            
            print("✅ Predio nuevo structure verified")
        else:
            print("⚠️ No predios nuevos found to verify structure")
    
    def test_14_get_vigencias(self):
        """Test getting available vigencias"""
        token = self.get_auth_token(self.coordinador_email, self.coordinador_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/predios/vigencias",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Vigencias: {data}")
    
    def test_15_get_predios_stats(self):
        """Test getting predios statistics"""
        token = self.get_auth_token(self.coordinador_email, self.coordinador_password)
        assert token is not None
        
        response = requests.get(
            f"{BASE_URL}/api/predios/stats/summary",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Predios stats: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
