function orderKeys(obj) {

  var keys = Object.keys(obj).sort(function keyOrder(k1, k2) {
      if (k1 < k2) return -1;
      else if (k1 > k2) return +1;
      else return 0;
  });

  var i, after = {};
  for (i = 0; i < keys.length; i++) {
    after[keys[i]] = obj[keys[i]];
    delete obj[keys[i]];
  }

  for (i = 0; i < keys.length; i++) {
    obj[keys[i]] = after[keys[i]];
    //recurse
    if (obj[keys[i]] instanceof Object) {
             obj[keys[i]] = orderKeys(obj[keys[i]]);
    }
  }
  return obj;
}

function cloneJSON(obj) {
    // basic type deep copy
    if (obj === null || obj === undefined || typeof obj !== 'object' || obj === "")  {
        return obj
    }
    // array deep copy
    if (obj instanceof Array) {
        var cloneA = [];
        for (var i = 0; i < obj.length; ++i) {
            cloneA[i] = cloneJSON(obj[i]);
        }
        if(cloneA.length > 0) {   
            return cloneA;
        } else {
            return null;
        }
    }        
    // object deep copy
    var cloneO = {};   
    for (var i in obj) {
        var c = cloneJSON(obj[i]);
        if(c !== null && c !== "") {
            cloneO[i] = c;
        }
    }
    return cloneO;
};

var textUtil = {



reduceJSON: function (cve) {
    //todo: this is to create a duplcate object
    // needs cleaner implementation
    var c = cloneJSON(cve);
    delete c.CNA_private;
    delete c.CNA_Private;
    var merged = {};
    var d;
    for (d of c.description.description_data) {
        if(d && d.lang) {
        if (!merged[d.lang]) {
            merged[d.lang] = [];
        }
        merged[d.lang].push(d.value);
        }
    }
    var new_d = [];
    for (var m in merged) {
        new_d.push({
            lang: m,
            value: merged[m].join("\n")
        });
    }
    c.description.description_data = new_d;
    if(c.impact && c.impact.cvss && c.impact.cvss.baseScore === 0) {
        delete c.impact;    
    }
    return(orderKeys(c));
},
    
getMITREJSON: function(cve) {
    return JSON.stringify(cve, null, "   ");
},
getPR: function(cve) {
    var matches = [];
    var re = /PRs?[ \t]+((or|and|[0-9\t\ \,])+)/igm;
    var m;
    while((m = re.exec(cve.solution)) !== null) {
        var prs = m[1].trim().split(/[ \t,andor]{1,}/).filter(x => x);
        matches = matches.concat(prs);
    }
    return matches;
},

getProductList: function (cve) {
    var lines = [];
    for (var vendor of cve.affects.vendor.vendor_data) {
        var pstring = [];
        for (var product of vendor.product.product_data) {
            pstring.push(product.product_name);
        }
        lines.push(vendor.vendor_name + " " + pstring.join(", "));
    }
    return lines.join("; ");
},

getAffectedProductString: function (cve) {
    var lines = [];
    for (var vendor of cve.affects.vendor.vendor_data) {
        var pstring = [];
        for(var product of vendor.product.product_data) {
            var vstring = [];
            for(var version of product.version.version_data) {
                var vv = version.version_value;
                if (version.platform) {
                    vv = vv + " on " + version.platform;
                }
                vstring.push(vv);
            }
            pstring.push(product.product_name + " " + vstring.join("; "));
        }
        lines.push(vendor.vendor_name + " " + pstring.join(", "));
    }
    return lines.join("; ");  
},

getProductAffected:
function (cve) {
    var gs = this.getAffectedProductString(cve);
    if (gs.length < 100)
        return 'This issue affects ' + gs + '.';
    var lines = [];
    for (var vendor of cve.affects.vendor.vendor_data) {
        var pstring = [];
        for(var product of vendor.product.product_data) {
            var vstring = [];
            var platforms = {};
            for (var version of product.version.version_data) {
                var vv = version.version_value;
                if (version.platform) {
                    var ps = version.platform.split(',');
                    for(var p of ps) {
                       platforms[p.trim()] = true; 
                    }
                }
                var toks = vv.trim().split(' ', 1);
                if(toks[0].match(/all/i)) {
                    vstring.push(vv.replace(/^\s*All/i, 'all'));
                } else if(toks[0] !== "") {
                    vstring.push(toks[0]);
                }
            }
            pstring.push('This issue affects ' + product.product_name + (
                vstring.length > 0 ? " " + vstring.join(", ") : '' )+ '.');
            if(Object.keys(platforms).length > 0) {
                pstring.push('Affected platforms: ' + Object.keys(platforms).join(', ') + '.');
            } else {

            }
        }
        lines.push(pstring.join(" "));
    }
    return lines.join();  
},

mergeJSON : function (target, add) {
    function isObject(obj) {
        if (typeof obj == "object") {
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    return true; 
                }
            }
        }
        return false;
    }
    for (var key in add) {
        if (add.hasOwnProperty(key)) {
            if (target[key] && isObject(target[key]) && isObject(add[key])) {
                this.mergeJSON(target[key], add[key]);
            } else {
                target[key] = add[key];
            }
        }
    }
    return target;
},
timeSince: function(date) {

  var seconds = Math.floor((new Date() - date) / 1000);

  var interval = Math.floor(seconds / 31536000);

  if (interval > 1) {
    return interval + " years";
  }
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) {
    return interval + " months";
  }
  interval = Math.floor(seconds / 86400);
  if (interval > 1) {
    return interval + " days";
  }
  interval = Math.floor(seconds / 3600);
  if (interval > 1) {
    return interval + " hours";
  }
  interval = Math.floor(seconds / 60);
  if (interval > 1) {
    return interval + " minutes";
  }
  return Math.floor(seconds) + " seconds";
},
    
//determine next bundle date
nextPatchDay : function (dateString) {
  const weekday = 3; //Wednesday
  const n = 2; //2nd Wednesday
  var date = new Date(dateString);
  var monthstogo = (12-date.getMonth()) % 3;
  //date.setMonth(date.getMonth()+ monthstogo);

  var count = 0,
  idate = new Date(date.getFullYear(), date.getMonth()+ monthstogo, 1);

  while (true) {
    if (idate.getDay() === weekday) {
      if (++count == n) {
        break;
      }
    }
    idate.setDate(idate.getDate() + 1);
  }
  if(idate < date) {
      return this.nextPatchDay(date.setMonth(date.getMonth()+1));
  } else {
    return idate;
  }
}
};
if(typeof module !== 'undefined') {
    module.exports = textUtil;
}