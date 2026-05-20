document.addEventListener("DOMContentLoaded", async () => {

    const grid = document.getElementById("services-grid");

    const res =
        await fetch("src/get_category_details.php");

    const categories = await res.json();

    categories.forEach(category => {

        let featuresHTML = "";

        category.features.forEach(feature => {

            featuresHTML += `
            
            <li>
                <i class="fa-solid fa-circle-check"></i>
                ${feature.feature_text}
            </li>
            `;
        });

        grid.innerHTML += `
        
        <div class="service-card">

            <div class="sc-header">

                <div class="sc-icon">
                    <i class="${category.icon_class}"></i>
                </div>

                <div class="sc-title">
                    ${category.category_name}
                </div>

                <div class="sc-subtitle">
                    ${category.short_description}
                </div>

            </div>

            <div class="sc-body">

                <ul class="sc-features">
                    ${featuresHTML}
                </ul>

                <a href="?category_id=${category.category_id}#service-details"
                   class="btn btn-primary"
                   style="width:100%;justify-content:center;">

                    <i class="fa-solid fa-arrow-right"></i>
                    View Details

                </a>

            </div>

        </div>
        `;
    });

});