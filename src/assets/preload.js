console.log("preloading..");
document.addEventListener('DOMContentLoaded', function() {
    console.log(document.body.innerText.replace(/\n/g, ' '));
    if (document.body.innerText.replace(/\n/g, ' ').search("Google Chrome 49+") !== -1)
        navigator.serviceWorker.getRegistrations().then(
            function(registrations) {
                console.log(registrations);
                for (let registration of registrations) {
                    registration.unregister();
                }
                //document.location.reload()
            }
        )
}, false);