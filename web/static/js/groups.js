document.addEventListener('DOMContentLoaded', () => {
    const groupsButton = document.querySelector('.groups-btn');
    if (groupsButton) {
        groupsButton.addEventListener('click', () => {
            switchToGroupsView();
        });
    }
});

function switchToGroupsView() {
    // Hide and clear the sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.style.display = 'none'; // Hide the sidebar
        sidebar.innerHTML = ''; // Clear the sidebar content
    }

    // Clear the posts container
    const postsContainer = document.getElementById('posts-container');
    if (postsContainer) {
        postsContainer.innerHTML = ''; // Clear the posts container
    }
}
