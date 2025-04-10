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

    // Hide the posts container
    const postsContainer = document.getElementById('posts-container');
    if (postsContainer) {
        postsContainer.style.display = 'none'; // Hide the posts container
    }

    // Update the heading text
    const mainHeading = document.querySelector('main h1');
    if (mainHeading) {
        mainHeading.textContent = ''; // Clear the main heading
    }

    // Hide the pagination container
    const paginationContainer = document.getElementById('pagination-container');
    if (paginationContainer) {
        paginationContainer.style.display = 'none'; // Hide the pagination
    }
        

    // Create Group List container
    let groupListContainer = document.getElementById('group-list-container');
    if (!groupListContainer) {
        groupListContainer = document.createElement('div');
        groupListContainer.id = 'group-list-container';

        // Create Group List header
        const groupListHeader = document.createElement('h3');
        groupListHeader.id = 'group-list-header';
        groupListHeader.textContent = 'Group List';
        groupListContainer.appendChild(groupListHeader);

        // Add content to Group List
        const groupListContent = document.createElement('div');
        groupListContent.id = 'group-list-content';
        groupListContent.innerHTML = `
            <ul>
                <li class="group-item">Group 1</li>
                <li class="group-item">Group 2</li>
                <li class="group-item">Group 3</li>
                <li class="group-item">Group 4</li>
            </ul>
        `;
        groupListContainer.appendChild(groupListContent);

        // Append Group List container to the body
        document.body.appendChild(groupListContainer);
    }

    // Create Group Activity container
    let groupActivityContainer = document.getElementById('group-activity-container');
    if (!groupActivityContainer) {
        groupActivityContainer = document.createElement('div');
        groupActivityContainer.id = 'group-activity-container';

        // Create Group Activity header
        const groupActivityHeader = document.createElement('h3');
        groupActivityHeader.id = 'group-activity-header';
        groupActivityHeader.textContent = 'Group Activity';
        groupActivityContainer.appendChild(groupActivityHeader);

        // Add content to Group Activity
        const groupActivityContent = document.createElement('div');
        groupActivityContent.id = 'group-activity-content';
        groupActivityContent.innerHTML = `
            <p>Select a group to view its activity.</p>
        `;
        groupActivityContainer.appendChild(groupActivityContent);

        // Append Group Activity container to the body
        document.body.appendChild(groupActivityContainer);
    }

    // Create Group Event container
    let groupEventContainer = document.getElementById('group-events-container');
    if (!groupEventContainer) {
        groupEventContainer = document.createElement('div');
        groupEventContainer.id = 'group-events-container';

        // Create Group Event header
        const groupEventHeader = document.createElement('h3');
        groupEventHeader.id = 'group-events-header';
        groupEventHeader.textContent = 'Group Events';
        groupEventContainer.appendChild(groupEventHeader);

        // Add content to Group Event
        const groupEventContent = document.createElement('div');
        groupEventContent.id = 'group-events-content';
        groupEventContent.innerHTML = `
            <p>Details about group events will appear here.</p>
        `;
        groupEventContainer.appendChild(groupEventContent);

        // Append Group Event container to the body
        document.body.appendChild(groupEventContainer);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const groupsButton = document.querySelector('.groups-btn');
    if (groupsButton) {
        groupsButton.addEventListener('click', () => {
            switchToGroupsView();
        });
    }
});