var keystone = require('keystone');
var async = require('async');
var moment = require('moment');
var ovh = require('ovh')({
	appKey: process.env.OVH_APP_KEY,
	appSecret: process.env.OVH_APP_SECRET,
	consumerKey: process.env.OVH_CONSUMER_KEY
});


exports = module.exports = function(req, res) {
	
	var view = new keystone.View(req, res),
	locals = res.locals;
	
	// locals.section is used to set the currently selected
	// item in the header navigation.
	locals.section = 'home';
	locals.formData = req.body || {};

	locals.data = {
		wifi: [],
	};


	

	view.on('init', function(next) {
		ovh.request('GET', '/xdsl/'+process.env.OVH_SERVICE_NAME+'/tasks', function (err, tasks) {
			locals.data.tasks = tasks;
			console.log("Tasks en cours",tasks);
			next();
		});
	});
	view.on('init', function(next) {
		locals.data.changeInProgress = false;
		async.each(locals.data.tasks,function(taskid){
			ovh.request('GET', '/xdsl/'+process.env.OVH_SERVICE_NAME+'/tasks/'+taskid, function (err, task) {
				if(task.function === 'changeModemConfigWLAN')
				{
					locals.data.changeInProgress = true;
				}
				console.log("Detail des tasks",task);
				next();
			});
		},function(err){next();});
		
	});

	// get wifi status
	view.on('init', function(next) {
		ovh.request('GET', '/xdsl/'+process.env.OVH_SERVICE_NAME+'/modem/wifi/'+process.env.OVH_WIFI_NAME, function (err, wifi) {
			locals.data.wifi = wifi;
			next();
		});
	});


	view.on('init', function(next) {

		if(locals.data.wifi.SSID == process.env.EPED_WIFI_PUBLIC_NAME)
		{
			locals.data.epedwifi = 'public';
			locals.data.couleur = '#1B9200';
		}else if(locals.data.wifi.SSID == process.env.EPED_WIFI_PRIVATE_NAME)
		{
			locals.data.epedwifi = 'privé';
			locals.data.couleur = '#FF5630';
		}
		next();
	});

	view.on('post', function(next){
		console.log('post !',locals.formData,locals.user);
		var ssid,passwd;
		var wifi_public,wifi_prive,wifi;

		wifi_public = {
			"channelMode": "Auto",
			"SSIDAdvertisementEnabled": true,
			"SSID": process.env.EPED_WIFI_PUBLIC_NAME,
			"securityType": "WPAandWPA2",
			"securityKey": process.env.EPED_WIFI_PUBLIC_PASS,
			"enabled": true
		};
		wifi_prive = {
			"channelMode": "Auto",
			"SSIDAdvertisementEnabled": true,
			"SSID": process.env.EPED_WIFI_PRIVATE_NAME,
			"securityType": "WPAandWPA2",
			"securityKey": process.env.EPED_WIFI_PRIVATE_PASS,
			"enabled": true
		};

		if(locals.formData.action == 'toprivate')
		{

			wifi = wifi_prive;
		}
		else
		{
			wifi = wifi_public;
		}

		ovh.request('PUT', '/xdsl/'+process.env.OVH_SERVICE_NAME+'/modem/wifi/'+process.env.OVH_WIFI_NAME,
			wifi ,function (err, wifi) {
				console.log('ok',err,wifi);
				if(err === null && locals.formData.action == 'toprivate')
				{
				//Planification de la réactivation du wifi public
				var endDate = moment().add(locals.formData.duree, 'm');
				var CronJob = require('cron').CronJob;
				console.log("planification de la réactivation du wifi a "+endDate.toDate()+".");
				var job = new CronJob(endDate.toDate(), function(){
					console.log("planification de la réactivation du wifi a "+endDate.toDate()+" faite !");
					ovh.request('PUT', '/xdsl/'+process.env.OVH_SERVICE_NAME+'/modem/wifi/'+process.env.OVH_WIFI_NAME,
						wifi_public ,function (err, wifi) {
							console.log('réactivation',err,wifi);
						});
				}, function () {
					
				},
				true /* Start the job right now */
				//,'Europe/Paris' /* Time zone of this job. */
				);
			}
		});

		setTimeout(function() {
			console.log('Waiting 3 secondes for redirect !');
			return res.redirect('/wifi');
		}, 3000);
	});

	// Render the view
	view.render('wifi');
	
};
