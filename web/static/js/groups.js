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

        // Fetch groups from the backend
        fetch('/groups', {
            method: 'GET',
            headers: {
            'Content-Type': 'application/json',
            },
            credentials: 'include',
        })
        .then(response => response.json())
        .then(data => {
            if (data.groups && data.groups.length > 0) {
            const groupList = document.createElement('ul');
            data.groups.forEach(group => {
                const groupItem = document.createElement('li');
                groupItem.className = 'group-item';
                groupItem.textContent = group.name;
                groupList.appendChild(groupItem);
            });
            groupListContent.appendChild(groupList);
            } else {
            groupListContent.textContent = 'No groups created yet!';
            }
        })
        .catch(error => {
            console.error('Error fetching groups:', error);
            groupListContent.textContent = 'Failed to load groups.';
        });
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

document.querySelector('.create-group-btn').addEventListener('click', function (e) {
    e.preventDefault();

    // Create the overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    // Add the form to the overlay
    overlay.innerHTML = `
<div class="card">
    <div id="create-group-response"></div>
    <form id="create-group-form">
        <label for="group-name">Group Name</label>
        <input type="text" id="group-name" placeholder="Group Name" required>
        
        <label for="group-description">Group Description</label>
        <textarea id="group-description" placeholder="Group Description" required></textarea>
        
        <label>Privacy Setting</label>
        <div id="group-privacy">
            <label>
                <input type="radio" name="privacy" value="Public" required> Public
            </label>
            <label>
                <input type="radio" name="privacy" value="Private" required> Private
            </label>
        </div>
        
        <button type="submit" id="submit-group-btn">Create Group</button>
    </form>
</div>
    `;

    document.body.appendChild(overlay);

    // Handle form submission
    document.getElementById('create-group-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const responseElement = document.getElementById('create-group-response');
        responseElement.textContent = 'Creating group...';

        const groupName = document.getElementById('group-name').value;
        const groupDescription = document.getElementById('group-description').value;

        try {
            const response = await fetch('/group/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: groupName,
                    description: groupDescription,
                }),
            });

            const data = await response.json();
            if (response.ok) {
                responseElement.textContent = `Group "${groupName}" created successfully!`;
                responseElement.style.color = 'green';
                overlay.remove(); // Remove the overlay after success
            } else {
                throw new Error(data.error || 'Failed to create group');
            }
        } catch (error) {
            responseElement.textContent = error.message;
            responseElement.style.color = 'red';
        }
    });

    // Close the overlay when clicking outside the form
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
});

