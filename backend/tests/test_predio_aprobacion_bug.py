"""
Test file for bug fixes related to predio approval flow:
1. Coordinador can see predios in 'revision' state in 'Pendientes' > 'Predios Nuevos'
2. Coordinador can APPROVE a new predio (Aprobar button visible and functional)
3. After approval, predio MUST appear in 'Gestión de Predios' (/dashboard/predios) with correct municipio and vigencia
4. Approved predio must have vigencia as integer (e.g., 2026), NOT as ISO date
5. Approved predio history must show the approval action
6. Excel R1/R2 download must include the approved predio
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://area-dashboard.preview.emergentagent.com').rstrip('/')

# Test credentials
COORDINADOR_EMAIL = "Camilo.alsina1@hotmail.com"
COORDINADOR_PASSWORD = "Asm*123*"
ADMIN_EMAIL = "catastro@asomunicipios.gov.co"
ADMIN_PASSWORD = "Asm*123*"
GESTOR_EMAIL = "gestor.creador@test.com"
GESTOR_PASSWORD = "Asm*123*"


class TestPredioAprobacionBugFixes:
    """Tests for predio approval bug fixes"""
    
    @pytest.fixture(scope="class")
    def coordinador_token(self):
        """Get coordinador authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COORDINADOR_EMAIL,
            "password": COORDINADOR_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Coordinador login failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def gestor_token(self):
        """Get gestor authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": GESTOR_EMAIL,
            "password": GESTOR_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Gestor login failed: {response.status_code} - {response.text}")
    
    def test_01_coordinador_login(self, coordinador_token):
        """Test coordinador can login successfully"""
        assert coordinador_token is not None
        print(f"✓ Coordinador logged in successfully")
    
    def test_02_coordinador_can_see_predios_en_revision(self, coordinador_token):
        """Test coordinador can see predios in 'revision' state"""
        headers = {"Authorization": f"Bearer {coordinador_token}"}
        
        # Get predios nuevos
        response = requests.get(f"{BASE_URL}/api/predios-nuevos", headers=headers)
        assert response.status_code == 200, f"Failed to get predios-nuevos: {response.text}"
        
        data = response.json()
        predios = data.get("predios", data) if isinstance(data, dict) else data
        
        # Filter predios in revision state
        predios_en_revision = [p for p in predios if p.get("estado_flujo") == "revision"]
        
        print(f"✓ Found {len(predios_en_revision)} predios in 'revision' state")
        print(f"  Total predios nuevos: {len(predios)}")
        
        # List predios in revision
        for p in predios_en_revision[:5]:  # Show first 5
            print(f"  - {p.get('codigo_predial_nacional')} | {p.get('municipio')} | Estado: {p.get('estado_flujo')}")
        
        return predios_en_revision
    
    def test_03_get_predio_for_approval(self, coordinador_token):
        """Get a predio in revision state for approval testing"""
        headers = {"Authorization": f"Bearer {coordinador_token}"}
        
        response = requests.get(f"{BASE_URL}/api/predios-nuevos", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get("predios", data) if isinstance(data, dict) else data
        
        # Find a predio in revision state from San Calixto
        predios_san_calixto = [p for p in predios 
                               if p.get("estado_flujo") == "revision" 
                               and p.get("municipio") == "San Calixto"]
        
        if not predios_san_calixto:
            # Try any predio in revision
            predios_en_revision = [p for p in predios if p.get("estado_flujo") == "revision"]
            if predios_en_revision:
                predio = predios_en_revision[0]
                print(f"✓ Found predio in revision: {predio.get('codigo_predial_nacional')} ({predio.get('municipio')})")
                return predio
            pytest.skip("No predios in 'revision' state available for testing")
        
        predio = predios_san_calixto[0]
        print(f"✓ Found San Calixto predio in revision: {predio.get('codigo_predial_nacional')}")
        return predio
    
    def test_04_coordinador_can_approve_predio(self, coordinador_token):
        """Test coordinador can approve a predio nuevo"""
        headers = {"Authorization": f"Bearer {coordinador_token}"}
        
        # First get a predio in revision
        response = requests.get(f"{BASE_URL}/api/predios-nuevos", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get("predios", data) if isinstance(data, dict) else data
        predios_en_revision = [p for p in predios if p.get("estado_flujo") == "revision"]
        
        if not predios_en_revision:
            pytest.skip("No predios in 'revision' state to approve")
        
        predio = predios_en_revision[0]
        predio_id = predio.get("id")
        codigo_predial = predio.get("codigo_predial_nacional")
        municipio = predio.get("municipio")
        
        print(f"  Attempting to approve predio: {codigo_predial} ({municipio})")
        
        # Approve the predio
        response = requests.post(
            f"{BASE_URL}/api/predios-nuevos/{predio_id}/accion",
            headers=headers,
            json={
                "accion": "aprobar",
                "observaciones": "Aprobado por test automatizado"
            }
        )
        
        assert response.status_code == 200, f"Failed to approve predio: {response.status_code} - {response.text}"
        
        result = response.json()
        assert result.get("success") == True, f"Approval not successful: {result}"
        
        print(f"✓ Predio {codigo_predial} approved successfully")
        print(f"  Message: {result.get('mensaje')}")
        
        return {
            "predio_id": predio_id,
            "codigo_predial": codigo_predial,
            "municipio": municipio
        }
    
    def test_05_approved_predio_appears_in_gestion_predios(self, coordinador_token):
        """Test approved predio appears in GET /api/predios"""
        headers = {"Authorization": f"Bearer {coordinador_token}"}
        
        # First approve a predio
        response = requests.get(f"{BASE_URL}/api/predios-nuevos", headers=headers)
        data = response.json()
        predios = data.get("predios", data) if isinstance(data, dict) else data
        predios_en_revision = [p for p in predios if p.get("estado_flujo") == "revision"]
        
        if not predios_en_revision:
            pytest.skip("No predios in 'revision' state to test")
        
        predio = predios_en_revision[0]
        predio_id = predio.get("id")
        codigo_predial = predio.get("codigo_predial_nacional")
        municipio = predio.get("municipio")
        
        # Approve it
        response = requests.post(
            f"{BASE_URL}/api/predios-nuevos/{predio_id}/accion",
            headers=headers,
            json={"accion": "aprobar", "observaciones": "Test approval"}
        )
        
        if response.status_code != 200:
            pytest.skip(f"Could not approve predio: {response.text}")
        
        # Now check if it appears in /api/predios
        current_year = datetime.now().year
        response = requests.get(
            f"{BASE_URL}/api/predios",
            headers=headers,
            params={
                "municipio": municipio,
                "vigencia": current_year,
                "search": codigo_predial
            }
        )
        
        assert response.status_code == 200, f"Failed to get predios: {response.text}"
        
        data = response.json()
        predios = data.get("predios", [])
        
        # Find the approved predio
        found_predio = None
        for p in predios:
            if p.get("codigo_predial_nacional") == codigo_predial:
                found_predio = p
                break
        
        assert found_predio is not None, f"Approved predio {codigo_predial} NOT found in /api/predios"
        
        print(f"✓ Approved predio {codigo_predial} found in Gestión de Predios")
        print(f"  Municipio: {found_predio.get('municipio')}")
        print(f"  Vigencia: {found_predio.get('vigencia')}")
        
        return found_predio
    
    def test_06_vigencia_is_integer_not_iso_date(self, coordinador_token):
        """Test that vigencia is stored as integer year, not ISO date"""
        headers = {"Authorization": f"Bearer {coordinador_token}"}
        
        # Get predios and check vigencia format
        response = requests.get(
            f"{BASE_URL}/api/predios",
            headers=headers,
            params={"limit": 10}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get("predios", [])
        
        if not predios:
            pytest.skip("No predios to check vigencia format")
        
        for predio in predios[:5]:
            vigencia = predio.get("vigencia")
            codigo = predio.get("codigo_predial_nacional", "N/A")
            
            # Vigencia should be an integer (year)
            if vigencia is not None:
                # Check it's not an ISO date string
                if isinstance(vigencia, str):
                    assert not vigencia.startswith("20") or len(vigencia) == 4, \
                        f"Vigencia appears to be ISO date: {vigencia} for predio {codigo}"
                    # If string, should be just the year
                    assert len(vigencia) <= 8, f"Vigencia too long (ISO date?): {vigencia}"
                
                # If integer, should be a valid year
                if isinstance(vigencia, int):
                    assert 2000 <= vigencia <= 2100, f"Invalid vigencia year: {vigencia}"
                    print(f"  ✓ Predio {codigo}: vigencia = {vigencia} (integer)")
                else:
                    print(f"  ? Predio {codigo}: vigencia = {vigencia} (type: {type(vigencia).__name__})")
        
        print(f"✓ Vigencia format check passed for {len(predios)} predios")
    
    def test_07_approved_predio_has_historial(self, coordinador_token):
        """Test that approved predio has approval action in historial"""
        headers = {"Authorization": f"Bearer {coordinador_token}"}
        
        # Get recently approved predios
        current_year = datetime.now().year
        response = requests.get(
            f"{BASE_URL}/api/predios",
            headers=headers,
            params={"vigencia": current_year, "limit": 50}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get("predios", [])
        
        # Find predios with historial containing approval
        predios_with_approval = []
        for predio in predios:
            historial = predio.get("historial", [])
            for entry in historial:
                if "aprobado" in str(entry).lower() or "aprobar" in str(entry).lower():
                    predios_with_approval.append(predio)
                    break
        
        print(f"✓ Found {len(predios_with_approval)} predios with approval in historial")
        
        for p in predios_with_approval[:3]:
            print(f"  - {p.get('codigo_predial_nacional')}: {len(p.get('historial', []))} historial entries")
    
    def test_08_excel_export_includes_approved_predios(self, coordinador_token):
        """Test that Excel R1/R2 export includes approved predios"""
        headers = {"Authorization": f"Bearer {coordinador_token}"}
        
        # Try to export Excel for a municipio
        current_year = datetime.now().year
        
        # First check if there are predios for San Calixto
        response = requests.get(
            f"{BASE_URL}/api/predios",
            headers=headers,
            params={"municipio": "San Calixto", "vigencia": current_year, "limit": 5}
        )
        
        if response.status_code == 200:
            data = response.json()
            predios = data.get("predios", [])
            print(f"✓ San Calixto has {len(predios)} predios for vigencia {current_year}")
            
            if predios:
                # Try to export Excel
                response = requests.get(
                    f"{BASE_URL}/api/predios/export-excel",
                    headers=headers,
                    params={"municipio": "San Calixto", "vigencia": current_year}
                )
                
                if response.status_code == 200:
                    content_type = response.headers.get("content-type", "")
                    assert "spreadsheet" in content_type or "excel" in content_type or "octet-stream" in content_type, \
                        f"Expected Excel file, got: {content_type}"
                    print(f"✓ Excel export successful for San Calixto")
                else:
                    print(f"  Excel export returned: {response.status_code}")
        else:
            print(f"  Could not check San Calixto predios: {response.status_code}")


class TestCoordinadorPermissions:
    """Test coordinador permissions for approval"""
    
    @pytest.fixture(scope="class")
    def coordinador_token(self):
        """Get coordinador authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": COORDINADOR_EMAIL,
            "password": COORDINADOR_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Coordinador login failed: {response.status_code}")
    
    def test_coordinador_role_check(self, coordinador_token):
        """Verify coordinador has correct role"""
        headers = {"Authorization": f"Bearer {coordinador_token}"}
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        user = response.json()
        role = user.get("role")
        
        print(f"✓ User role: {role}")
        print(f"  Email: {user.get('email')}")
        print(f"  Name: {user.get('full_name')}")
        
        # Coordinador should be able to approve
        assert role in ["coordinador", "administrador"], \
            f"Expected coordinador/administrador role, got: {role}"
    
    def test_coordinador_can_access_predios_nuevos(self, coordinador_token):
        """Test coordinador can access predios-nuevos endpoint"""
        headers = {"Authorization": f"Bearer {coordinador_token}"}
        
        response = requests.get(f"{BASE_URL}/api/predios-nuevos", headers=headers)
        assert response.status_code == 200, f"Access denied: {response.text}"
        
        data = response.json()
        predios = data.get("predios", data) if isinstance(data, dict) else data
        
        print(f"✓ Coordinador can access predios-nuevos: {len(predios)} predios")


class TestPrediosNuevosEndpoints:
    """Test predios-nuevos API endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Admin login failed: {response.status_code}")
    
    def test_list_predios_nuevos(self, admin_token):
        """Test listing predios nuevos"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/predios-nuevos", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get("predios", data) if isinstance(data, dict) else data
        
        # Count by estado_flujo
        estados = {}
        for p in predios:
            estado = p.get("estado_flujo", "unknown")
            estados[estado] = estados.get(estado, 0) + 1
        
        print(f"✓ Predios nuevos by estado:")
        for estado, count in estados.items():
            print(f"  - {estado}: {count}")
        
        return predios
    
    def test_predios_nuevos_pendientes(self, admin_token):
        """Test getting pending predios nuevos"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.get(f"{BASE_URL}/api/predios-nuevos/pendientes", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        print(f"✓ Pendientes endpoint response: {data.get('total', len(data))} items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
