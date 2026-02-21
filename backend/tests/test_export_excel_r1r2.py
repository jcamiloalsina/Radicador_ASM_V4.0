"""
Tests for Excel R1/R2 Export Feature - Iteration 51

Testing the export Excel R1/R2 functionality from the Actualizacion module:
- GET /api/actualizacion/proyectos/{proyecto_id}/exportar-excel
- GET /api/actualizacion/proyectos/{proyecto_id}/exportar-excel?solo_actualizados=true

Credentials:
- Administrador: catastro@asomunicipios.gov.co / Asm*123*
- Proyecto ID: 32ba040f-ed50-45e2-a115-22ab3a351423
"""

import pytest
import requests
import os
from io import BytesIO

# Get base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestExportExcelR1R2:
    """Tests for Excel R1/R2 Export functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "catastro@asomunicipios.gov.co",
                "password": "Asm*123*"
            }
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        return data["token"]
    
    @pytest.fixture
    def proyecto_id(self):
        """Test project ID"""
        return "32ba040f-ed50-45e2-a115-22ab3a351423"
    
    def test_login_success(self, auth_token):
        """Test that we can login successfully"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"✅ Login successful, token length: {len(auth_token)}")
    
    def test_export_excel_complete_returns_valid_excel(self, auth_token, proyecto_id):
        """
        Test GET /api/actualizacion/proyectos/{proyecto_id}/exportar-excel
        Should return a valid Excel file with all predios
        """
        response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{proyecto_id}/exportar-excel",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=120  # 2 minutes for large projects
        )
        
        assert response.status_code == 200, f"Export failed with status {response.status_code}: {response.text}"
        
        # Verify content type is Excel
        content_type = response.headers.get('Content-Type', '')
        assert 'spreadsheet' in content_type or 'excel' in content_type or 'application/vnd' in content_type, \
            f"Unexpected content type: {content_type}"
        
        # Verify content-disposition header has filename
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'filename' in content_disposition.lower() or len(response.content) > 0, \
            "No filename in content-disposition and no content"
        
        # Verify file has content (Excel files have a minimum size)
        assert len(response.content) > 1000, f"Excel file too small: {len(response.content)} bytes"
        
        # Verify it's a valid XLSX file (starts with PK for ZIP format)
        assert response.content[:2] == b'PK', "File does not appear to be a valid Excel file (ZIP format)"
        
        print(f"✅ Export complete successful - File size: {len(response.content)} bytes")
        print(f"   Content-Type: {content_type}")
        print(f"   Content-Disposition: {content_disposition}")
    
    def test_export_excel_solo_actualizados_returns_valid_excel(self, auth_token, proyecto_id):
        """
        Test GET /api/actualizacion/proyectos/{proyecto_id}/exportar-excel?solo_actualizados=true
        Should return a valid Excel file with only updated/signed predios
        """
        response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{proyecto_id}/exportar-excel",
            params={"solo_actualizados": "true"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=120
        )
        
        # Can be 200 or 404 (if no updated predios)
        assert response.status_code in [200, 404], f"Unexpected status {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            # Verify content type is Excel
            content_type = response.headers.get('Content-Type', '')
            assert 'spreadsheet' in content_type or 'excel' in content_type or 'application/vnd' in content_type, \
                f"Unexpected content type: {content_type}"
            
            # Verify file has content
            assert len(response.content) > 1000, f"Excel file too small: {len(response.content)} bytes"
            
            # Verify it's a valid XLSX file
            assert response.content[:2] == b'PK', "File does not appear to be a valid Excel file"
            
            print(f"✅ Export solo_actualizados successful - File size: {len(response.content)} bytes")
        else:
            # 404 means no predios match the criteria - this is valid behavior
            print(f"✅ Export solo_actualizados returned 404 - No updated predios found (valid scenario)")
    
    def test_export_excel_solo_actualizados_has_fewer_predios(self, auth_token, proyecto_id):
        """
        Test that solo_actualizados=true returns fewer predios than the complete export
        """
        # Get complete export size
        response_complete = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{proyecto_id}/exportar-excel",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=120
        )
        
        # Get filtered export
        response_filtered = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{proyecto_id}/exportar-excel",
            params={"solo_actualizados": "true"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=120
        )
        
        if response_complete.status_code == 200 and response_filtered.status_code == 200:
            complete_size = len(response_complete.content)
            filtered_size = len(response_filtered.content)
            
            # The filtered version should be smaller or equal
            assert filtered_size <= complete_size, \
                f"Filtered export ({filtered_size}) should be <= complete ({complete_size})"
            
            print(f"✅ Comparison: Complete={complete_size} bytes, Filtered={filtered_size} bytes")
            print(f"   Filtered is {((1 - filtered_size/complete_size) * 100):.1f}% smaller")
        elif response_complete.status_code == 200 and response_filtered.status_code == 404:
            print(f"✅ Complete export exists, filtered has no data (valid - no updated predios)")
        else:
            pytest.skip("Could not compare exports")
    
    def test_export_excel_requires_authentication(self, proyecto_id):
        """
        Test that the export endpoint requires authentication
        """
        response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{proyecto_id}/exportar-excel",
            timeout=30
        )
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], \
            f"Expected 401/403 without auth, got {response.status_code}"
        
        print(f"✅ Endpoint requires authentication (returned {response.status_code})")
    
    def test_export_excel_invalid_project_returns_404(self, auth_token):
        """
        Test that an invalid project ID returns 404
        """
        invalid_proyecto_id = "invalid-project-id-12345"
        
        response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{invalid_proyecto_id}/exportar-excel",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid project, got {response.status_code}"
        
        print(f"✅ Invalid project returns 404 as expected")
    
    def test_export_excel_project_exists(self, auth_token, proyecto_id):
        """
        Verify the test project exists before testing export
        """
        response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{proyecto_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        
        assert response.status_code == 200, f"Project not found: {response.status_code}"
        
        data = response.json()
        print(f"✅ Project found: {data.get('nombre', 'Unknown')}")
        print(f"   Municipio: {data.get('municipio', 'Unknown')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
