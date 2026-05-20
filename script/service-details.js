document.addEventListener("DOMContentLoaded", async () => {

    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get("category_id");

    const container = document.getElementById("services-container");

    if (!categoryId) return;

    try {

        const response = await fetch(
            `src/get_services.php?category_id=${categoryId}`
        );

        const services = await response.json();

        container.innerHTML = ""; // important reset

        services.forEach(service => {

            container.innerHTML += `
            <div class="subservice-item"
                data-id="${service.service_id}"
                onclick="loadService(${service.service_id})">

                <div class="sub-icon">
                    <i class="${service.icon_class}"></i>
                </div>

                <div>
                    <div class="sub-title">
                        ${service.service_name}
                    </div>

                    <div class="sub-desc">
                        ${service.description}
                    </div>
                </div>

            </div>
            `;
        });

        // ✅ WAIT UNTIL DOM IS UPDATED BEFORE AUTO-SELECT
        requestAnimationFrame(() => {

            const firstService = services[0];

            if (!firstService) return;

            const firstItem =
                document.querySelector(`.subservice-item[data-id="${firstService.service_id}"]`);

            if (firstItem) {
                firstItem.classList.add("active");
            }

            loadService(firstService.service_id);
        });

    } catch (error) {
        console.error(error);
    }
});


async function loadService(serviceId) {

    document
    .querySelectorAll(".subservice-item")
    .forEach(item => {

        item.classList.remove("active");

        if(item.dataset.id == serviceId){
            item.classList.add("active");
        }

    });

    try {

        const response = await fetch(
            `src/get_service_details.php?service_id=${serviceId}`
        );

        const data = await response.json();

        // PRICE
        document.getElementById("overview-price")
            .textContent = data.service.price_range;

        // DURATION
        document.getElementById("overview-duration")
            .textContent = data.service.duration_text;

        document.getElementById("detail-title")
            .textContent = data.service.detail_title;

        document.getElementById("detail-description")
            .textContent = data.service.detail_description;

        document.getElementById("overview-category-name")
            .textContent = data.service.category_name;

        // MODES
        const modesContainer =
            document.getElementById("overview-modes");

        modesContainer.innerHTML = "";

        data.modes.forEach(mode => {

            let modeClass = "";

            if(mode.mode_name.includes("Walk"))
                modeClass = "walkin";

            else if(mode.mode_name.includes("Home"))
                modeClass = "home";

            else if(mode.mode_name.includes("Online"))
                modeClass = "online";

            modesContainer.innerHTML += `

            <div class="mode-tag ${modeClass}"
                style="width:fit-content">

                <i class="${mode.icon_class}"></i>

                ${mode.mode_name}

            </div>
            `;
        });

        // SERVICES OFFERED
        const itemsContainer =
            document.getElementById("overview-items");

        itemsContainer.innerHTML = "";

        data.items.forEach(item => {

    itemsContainer.innerHTML += `

    <li>

        <div style="
            font-weight:700;
            color:var(--text);
            margin-bottom:4px;
        ">
            ${item.title}
        </div>


    </li>
    `;
});

    } catch(error) {
        console.error(error);
    }

}