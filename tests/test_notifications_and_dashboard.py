"""
Test suite for Notifications and Dashboard Stats APIs
Tests the bug fixes for:
1. Dashboard 'Devueltos' counter showing correct count
2. Notification system - marking as read
3. Dashboard stats accuracy
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cadastral-update.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "catastro@asomunicipios.gov.co"
ADMIN_PASSWORD = "Asm*123*"


class TestAuth:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin login returns valid token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "administrador"
        return data["token"]


class TestDashboardStats:
    """Dashboard statistics endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_dashboard_stats_returns_all_states(self, auth_token):
        """Test GET /api/petitions/stats/dashboard returns all petition states"""
        response = requests.get(
            f"{BASE_URL}/api/petitions/stats/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Stats endpoint failed: {response.text}"
        
        data = response.json()
        
        # Verify all required fields are present
        required_fields = ["total", "radicado", "asignado", "rechazado", "revision", "devuelto", "finalizado"]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
            assert isinstance(data[field], int), f"Field {field} should be integer"
        
        # Verify total is sum of all states
        sum_states = (data["radicado"] + data["asignado"] + data["rechazado"] + 
                      data["revision"] + data["devuelto"] + data["finalizado"])
        assert data["total"] == sum_states, f"Total ({data['total']}) != sum of states ({sum_states})"
        
        print(f"Dashboard stats: {data}")
    
    def test_devuelto_count_matches_actual_petitions(self, auth_token):
        """Test that 'devuelto' count matches actual petitions with that state"""
        # Get stats
        stats_response = requests.get(
            f"{BASE_URL}/api/petitions/stats/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert stats_response.status_code == 200
        stats = stats_response.json()
        
        # Get all petitions
        petitions_response = requests.get(
            f"{BASE_URL}/api/petitions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert petitions_response.status_code == 200
        petitions = petitions_response.json()
        
        # Count devueltos manually
        devueltos = [p for p in petitions if p.get("estado") == "devuelto"]
        
        assert stats["devuelto"] == len(devueltos), \
            f"Stats devuelto ({stats['devuelto']}) != actual count ({len(devueltos)})"
        
        print(f"Devuelto count verified: {len(devueltos)}")
        if devueltos:
            for p in devueltos:
                print(f"  - {p.get('radicado')}: {p.get('nombre_completo')}")


class TestNotifications:
    """Notification system tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_notifications(self, auth_token):
        """Test GET /api/notificaciones returns notifications list and unread count"""
        response = requests.get(
            f"{BASE_URL}/api/notificaciones",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        
        data = response.json()
        assert "notificaciones" in data
        assert "no_leidas" in data
        assert isinstance(data["notificaciones"], list)
        assert isinstance(data["no_leidas"], int)
        
        print(f"Notifications: {len(data['notificaciones'])}, Unread: {data['no_leidas']}")
    
    def test_mark_notification_as_read(self, auth_token):
        """Test PATCH /api/notificaciones/{id}/leer marks notification as read"""
        # First get notifications
        response = requests.get(
            f"{BASE_URL}/api/notificaciones",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if not data["notificaciones"]:
            pytest.skip("No notifications to test")
        
        # Get first notification
        notif = data["notificaciones"][0]
        notif_id = notif["id"]
        
        # Mark as read
        mark_response = requests.patch(
            f"{BASE_URL}/api/notificaciones/{notif_id}/leer",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert mark_response.status_code == 200, f"Mark as read failed: {mark_response.text}"
        
        result = mark_response.json()
        assert "message" in result
        print(f"Marked notification {notif_id} as read: {result['message']}")
    
    def test_mark_all_notifications_as_read(self, auth_token):
        """Test POST /api/notificaciones/marcar-todas-leidas marks all as read"""
        response = requests.post(
            f"{BASE_URL}/api/notificaciones/marcar-todas-leidas",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Mark all as read failed: {response.text}"
        
        result = response.json()
        assert "message" in result
        print(f"Mark all as read result: {result['message']}")
        
        # Verify no unread notifications remain
        verify_response = requests.get(
            f"{BASE_URL}/api/notificaciones",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        
        assert verify_data["no_leidas"] == 0, \
            f"Expected 0 unread, got {verify_data['no_leidas']}"
        print("Verified: All notifications marked as read")
    
    def test_mark_invalid_notification_returns_404(self, auth_token):
        """Test marking non-existent notification returns 404"""
        response = requests.patch(
            f"{BASE_URL}/api/notificaciones/invalid-id-12345/leer",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestPetitionsFiltering:
    """Test petition filtering functionality"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_all_petitions(self, auth_token):
        """Test GET /api/petitions returns all petitions for admin"""
        response = requests.get(
            f"{BASE_URL}/api/petitions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get petitions failed: {response.text}"
        
        petitions = response.json()
        assert isinstance(petitions, list)
        assert len(petitions) > 0, "Expected at least one petition"
        
        # Verify petition structure
        petition = petitions[0]
        assert "id" in petition
        assert "estado" in petition
        
        print(f"Total petitions: {len(petitions)}")
    
    def test_devuelto_petitions_exist(self, auth_token):
        """Test that petitions with 'devuelto' state exist and can be filtered"""
        response = requests.get(
            f"{BASE_URL}/api/petitions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        petitions = response.json()
        devueltos = [p for p in petitions if p.get("estado") == "devuelto"]
        
        # Based on dashboard stats, there should be 1 devuelto
        print(f"Found {len(devueltos)} petitions with 'devuelto' state")
        
        for p in devueltos:
            print(f"  Radicado: {p.get('radicado')}")
            print(f"  Nombre: {p.get('nombre_completo')}")
            print(f"  Estado: {p.get('estado')}")
            print(f"  Municipio: {p.get('municipio')}")
    
    def test_all_states_have_correct_counts(self, auth_token):
        """Verify all petition states match dashboard stats"""
        # Get stats
        stats_response = requests.get(
            f"{BASE_URL}/api/petitions/stats/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert stats_response.status_code == 200
        stats = stats_response.json()
        
        # Get all petitions
        petitions_response = requests.get(
            f"{BASE_URL}/api/petitions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert petitions_response.status_code == 200
        petitions = petitions_response.json()
        
        # Count by state
        state_counts = {}
        for p in petitions:
            estado = p.get("estado", "unknown")
            state_counts[estado] = state_counts.get(estado, 0) + 1
        
        print(f"State counts from petitions: {state_counts}")
        print(f"Stats from dashboard: {stats}")
        
        # Verify each state
        for state in ["radicado", "asignado", "rechazado", "revision", "devuelto", "finalizado"]:
            actual = state_counts.get(state, 0)
            expected = stats.get(state, 0)
            assert actual == expected, \
                f"State '{state}': actual ({actual}) != expected ({expected})"
        
        print("All state counts verified!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
