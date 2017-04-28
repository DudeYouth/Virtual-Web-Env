'use strict';
let express = require('express');
let exec = require('child_process').exec; 
let router = express.Router();
let fs = require('fs');

// 创建随机字符串
let createStr = (n)=>{
	let chars = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','s','y','z','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
    let res = "";
    for(let i = 0; i < n ; i ++) {
        let id = Math.ceil(Math.random()*chars.length-1);
        res += chars[id];
    }
    return res;
}

// 获取运行中的端口号
let getPort = (arr)=>{
	let ports = [];
	arr&&arr.length && arr.forEach((value) => {
		let arr = value.split('_');
		ports.push(arr[1]);
	})
	return ports;
	
}

// 转换日期
let conversionDate = (day)=>{
	return day * 24 * 60 * 60;
}

// 生成端口号
let createPort = (ports)=>{
	let port = parseInt(Math.random() * 5 + 1) * 10000;
	if(ports.indexOf(port)!=-1){
		createPort(ports);
	}else{
		return port;
	}
}

// 获取客户端ip
let getClientIp = (req) => {
    let ipAddress;
    let forwardedIpsStr = req.header('x-forwarded-for'); 
    if (forwardedIpsStr) {
        let forwardedIps = forwardedIpsStr.split(',');
        ipAddress = forwardedIps[0];
    }
    if (!ipAddress) {
        ipAddress = req.connection.remoteAddress;
    }
    return ipAddress.split(':')[3]||ipAddress;
}

// ip是都被使用
let hasIp = (ips,ip)=>{
	for(let i=0;i<ips.length;i++){
		if(parseFloat(ips[i].split('_')[2].toString().split('-').join('.'))==parseFloat(ip)){
			return true;
		}
	}
	return false;
}

/* GET home page. */
router.get(['/','/index'], function(req, res, next) {
    let data = {
        times: [{
                title: '1天',
                value: 1,
            },
            {
                title: '2天',
                value: 2,
            },
            {
                title: '3天',
                value: 3,
            }
        ],
        systems: ['nginx','nodejs']   // 'xmapp',
    }
	exec('sudo docker ps -a',(err,content)=>{
		let arr = content.match(/\/tcp\s+?[0-9a-zA-Z]{8}_([1-5]0000)_[0-9\-]+?(\s|$)/g);
		let ports = getPort(arr,content);
		data.number = ports.length;
		res.render('index', data);
	})
});



// 申请
router.use('/result',function(req, res, next) {
    let day = req.body.day||0;
    let systems = ['nginx', 'xmapp', 'nodejs', 'all'];
    let systemType = req.body.systemType;
	let passwd = createStr(8);
	
	// 判断数据是否正确
    if (systems.indexOf(systemType)!=-1 && day >= 1 && day <= 3) {
		exec('sudo docker ps -a',(err,content)=>{
			let arr = content.match(/\/tcp\s+?[0-9a-zA-Z]{8}_([1-5]0000)_[0-9\-]+?(\s|$)/g);
			let ports = getPort(arr,content);
			let port = createPort(ports);
			let ip = getClientIp(req);
			let dockerName = (createStr(8)+'_'+port+'_')+ip.split('.').join('-');
			if(arr&&hasIp(arr,ip)){
				res.render('error',{content:'您已经申请了虚拟机，请不要重复申请！',url:'http://123.56.220.42:3000/index',time:3});
				return false;
			}
			// 最多只能开启六个容器
			if(ports&&ports.length>=5){
				res.render('error',{content:'今天的申请名额已满！',url:'http://123.56.220.42:3000/index',time:3});
				return false;
			}
			let command = `sudo docker run --name ${dockerName} -itdp ${port+22}:22 -p ${port+23}:23 -p ${port+8080}:8080 -p ${port+80}:80 -p ${port+3000}:3000 -p ${port+3306}:3306 -p ${port+8888}:8888 -p ${port+21}:21 ubuntu-${systemType}`;
			// 容器的端口映射
			let maps = {
				'21': port + 21,
				'22': port + 22,
				'23': port + 23,
				'80': port + 80,
				'3000': port + 3000,
				'3306': port + 3306,
				'8888': port + 8888,
				'8080': port + 8080,
			}
			// 创建容器
			exec(command,(err,result)=>{
				// 把天转换成秒
				let times = conversionDate(day);
				// 定时清除容器
				exec(`sleep ${times}&&docker stop ${dockerName}&&sudo docker rm ${dockerName}`,(err,result)=>{
				});
				let command = `(sleep 1;echo ${passwd};sleep 1;echo ${passwd}) | docker exec -i ${dockerName} passwd root`;
				// 修改root密码
				exec(command,(err,result)=>{
					// 重启ssh服务器
					exec(`sudo docker exec -i ${dockerName} service ssh restart`,()=>{
						res.render('result', {number:ports.length, all:{username:'root',passwd:passwd,ports:maps,ip:'123.56.220.42'}});
					})

				})
			})		
		})

        // await process.exec('crontab -e');
        // await process.exec('crontab -e');
    } else {
        res.render('error', { content: '参数错误！',url:'http://123.56.220.42:3000/index' ,time:3});
		return false;
    }
});
router.use(function(req, res, next) {
	res.render('error', { content: '谢谢您的支持，功能正在开发中！',url:'http://123.56.220.42:3000/index' ,time:3});
})

module.exports = router;