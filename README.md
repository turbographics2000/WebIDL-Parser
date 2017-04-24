# WebIDL Parser
構文解析という高度な解析を行っているわけではなく、DOMの構造から解析する方法をとっている。  
WebRTCのドラフト仕様ページのDOM構成は下記のようになっており、この構成でパースを行う。  
下記のHTML構成を見ればわかるように、クラスでパースを行う。  
まず、クラスが"idl"のものを取得し、ループでその配下の要素をパースする。  
WebRTCのドラフト仕様ページのWebIDLをパースすることが第一の目的で、WebRTC以外の仕様のページでも解析出来る可能性はあるが、特にrequireの要素がない場合はパースはできない。  

```html
optional: 任意,
require:  親classの要素があれば必須,
many:     任意(0回含む) 複数回

<!-- Dictionary -->
<pre class="idl">
  <span class="idlDictionary">many
    <span class="idlDictionaryID">ruqire</span>
    <span class="idlMember">
      <span class="extAttr">optional
        <span class="extAttrName">require</span>
        <span class="extAttrRhs">optional</span>
      </span>
      <span class="idlMemberType">require</span>
      <span class="idlMemberName">require</span>
    </span>
    <span class="idlMember">many
      <span class="idlMemberType">require</span>
      <span class="idlMemberName">require</span>
      <span class="idlMemberValue">optional</span>
    </span>
  </span>
</pre>

<!-- Interface -->
<pre class="idl">
  <span class="idlInterface">many
    <span class="idlCtor">optional
      <span class="extAttrName">require</span>
      <span class="idlParam">optinal
        <span class="idlParamType">require</span>
        <span class="idlParamName">require</span>
      </span>
    </span>
    <span class="idlInterfaceID">require</span>
    <span class="idlSuperclass">optional</span>
    <span class="idlMethod">many
      <span class="idlMethType">require</span>
      <span class="idlMethName">require</span>
      <span class="idlParam">optional
        <span class="idlParamType">require</span>
        <span class="idlParamName">require</span>
      </span>
    </span>
    <span class="idlAttribute">many
      <span class="idlAttrType">require</span>
      <span class="idlAttrName">require</span>
    </span>
  </span>
</pre>

<!-- Enum -->
<pre class="idl">
  <span class="idlEnum">many
    <span class="idlEnumID">require</span>
    <a class="idlEnumItem">require</a>
  </span>
</pre>

<!-- Callback -->
<pre class="idl">
  <span class="idlCallback">many
    <span class="idlCallbackID">require</span>
    <span class="idlCallbackType">require</span>
    <span class="idlParam">optional
      <span class="idlParamType">require</span>
      <span class="idlParamName">require</span>
    </span>
  </span>
</pre>
```


## 使用方法
WebIDLParse()を実行する。第一引数は必須で仕様ページのdomを渡す。第二引数にtrueを渡すと、最適化された解析結果のデータを戻す。
```javascript
var parseData = WebIDLParse(dom, false);
```


## 解析結果データ構造(最適化なしの構造)
WebRTCのドラフト仕様ページでは、実際には
* Callback
* Dictionary
* Enum
* Interface

の４つのタイプがあり、このタイプごとにまとめている。ただし、RTCStatsReportはInterfaceに属するがMaplikeというmap型であるため、
この４つのタイプにMaplikeというタイプを追加して、合計５つのタイプとして管理している。

* Callback
* Dictionary
* Enum
* Interface
* Maplike


```javascript
{
  "Callback": {
    // ...
  },
  "Dictionary": {
    // ...
  },
  "Enum": {
    // ...
  },
  "Interface": {
    // ...
  },
  "Maplike": {
    // ...
  }
}
```

### "data_type"キー、"typeName"キー、"FrozenArray"キー、"record"キー、"sequence"キー(、"Promise"キー)
WebIDLのデータ型には、byteやunsined long, float, stringといった基本的な型やクラスなどがある。
解析データには"data_type"というキーで型情報を出力する。  
例えば、RTCPeerConnectionのaddTransceiver()の第一引数は、(MediaStreamTrack or DOMString)と複数の型を渡すことができる。  このような場合にも対応できるよう"data_type"の値は配列となっている。  
"data_type"の配列の要素は"typeName"キー(値は型名)と、"FrozenArray"、"record"、"sequence"という型を修飾するキーワードがある場合は、そのキーワードのキー(値はtrue)を持つオブジェクトになる。  
RTCPeerConnectionのpeerIdentityは、WebIDLにおいてはメソッドではないのだが型がPromise型になっている。このRTCPeerConnectionのpeerIdentityのように、メソッドの戻り値ではなくメンバーの型がPromise型となっている場合は、"data_type"の配下に"Promise"キーが追加される。  
(メソッドの場合はメソッドの配下に"Promise"キーが追加される。)  
"data_type"はコンストラクターのパラメーターの型、メソッドのパラメーターや戻り値の型、メンバーの型、Maplikeのkey/valueの型などに出力される。

解析データ出力例
```javascript
{
  "Dictionary": {
    "RTCConfiguration": {
      "Member": {
        "iceServers": {
          "data_type": [
              {
                "sequence": true,
                "typeName": "RTCIceServer"
              }
          ]
        },
      }
    }
  }
}
```

### "extAttr"キー、"extAttrName"キー、"extAttrRhs"キー
属性は、DictionaryやInterface自体やDictionaryやInterfaceの各メンバーなどに設定される。
属性がある場合は、それぞれのキーの配下に"extAttr"キーとして出力される。  
複数の属性がある場合が考えられるため値は配列となる。
DictionaryやInterface自体の属性の場合、WebIDL仕様においてはコンストラクターも属性に含まれるが、コンストラクターは"Ctor"キーで出力し、コンストラクター以外に属性がある場合に"extAttr"キーで出力される。
"extAttr"キーは、"extAttrName"キー(属性名)、また値がある場合は"extAttrRhs"キーとして出力される。

解析データ出力例
```javascript
{
  "Interface": {
    "RTCErrorEvent": {
      "extAttr": [
          {
            "extAttrName": "Exposed",
            "extAttrRhs": "Window"
          }
      ],
    }
  }
}
```

### "param"キー、"over_load"キー、"paramName"キー、"optional"キー
コンストラクターやメソッド、コールバックのパラメーター(引数)が"param"キーに出力される。
引数の順番が重要となるため値は配列となり、配列の要素は"paramName"キー(引数名)と"data_type"キーを持つオブジェクトになる。
また、optional引数には、解析データに"optional"キー(値はturu)が追加される。
ただし、複数のコンストラクターやメソッドのオーバーロードがある場合は、"param"キーではなく"over_load"キーで配列で出力され、
配列の配下にパラメーターのパターンの配列が出力される。

解析データ出力例("param"キー)
```javascript
{
  "Callback": {
    "RTCPeerConnectionErrorCallback": {
      "param": [
        {
          "name": "error",
          "data_type": [
            {
              "typeName": "DOMException"
            }
          ]
        }
      ]
    },
  }
}
```

解析データ出力例("over_load"キー)
```javascript
{
  "Interface": {
    "RTCDataChannel": {
      "method": [
        "send": {
          // ...
          "over_load": [
            [
              {
                "paramName": "data",
                "data_type": [
                  {
                    "typeName": "USVString"
                  }
                ]
              }
            ],
            [
              {
                "paramName": "data",
                "data_type": [
                  {
                    "typeName": "Blob"
                  }
                ]
              }
            ],
            [
              {
                "paramName": "data",
                "data_type": [
                  {
                    "typeName": "ArrayBuffer"
                  }
                ]
              }
            ],
            [
              {
                "paramName": "data",
                "data_type": [
                  {
                    "typeName": "ArrayBufferView"
                  }
                ]
              }
            ]
          ]
        }
      }
    }
  }
}
```

### "Callback"キー
WebRTCのドラフト仕様ページで定義されているコールバックは、コールバックで渡される引数を定義したものとなっている。  
解析データでは"Callback"というキーの配下にまとめられて出力される。
引数の情報は"param"キーが配下に出力される。

解析データ出力例
```javascript
{
  "Callback": {
    "RTCPeerConnectionErrorCallback": {
      "param": [
        {
          "name": "error",
          "data_type": [
            {
              "typeName": "DOMException"
            }
          ]
        }
      ]
    },
  }
}
```

### "Enum"キー
列挙型はEnumキーの配下にまとめられ、名前をキーとして出力される。  
列挙型の各値は、"items"キーに配列として出力される。

解析データ出力例
```javascript
{
  "Enum": {
    "RTCIceCredentialType": {
      "items": [
        "password",
        "token"
      ]
    },
    // ...
  }
}
```

### "Maplike"キー
WebRTCのドラフト仕様ページでMaplikeが使用されているのは、現時点でRTCStatsReportのみである。  
RTCStatsReportはInterfaceだが、Maplikeという特殊な型で定義されているため、Maplikeキーを設けて出力する。  
キーの配下には"key"キーと"value"キーを配置。それぞれの値は"data_type"キーを有するオブジェクトを出力する。

解析データ出力例
```javascript
{
  "Maplike": {
    "RTCStatsReport": {
      "key": {
        "data_type": [
          {
            "typeName": "DOMString"
          }
        ]
      },
      "value": {
        "data_type": [
          {
            "typeName": "object"
          }
        ]
      }
    }
  }
}
```

### "Dictionary"キー, "Interface"キー
DictionaryやInterfaceはクラスに相当する。  
解析データには、"Dictionary"キーや"Interface"キーの配下にそれぞれまとめられ名前をキーとして出力される。

解析データ出力例
```javascript
{
  "Dictionary": {
    "RTCConfiguration": {
      // ...
    }
    // ...
  },
  "Interface": {
    "RTCPeerConnection": {
      // ...
    }
    // ...
  },
}
```

#### "Superclass"キー
基底クラスがある場合、解析データに"Superclass"というキー(値は基底クラス名)が追加される。

解析データ出力例
```javascript
{
  "Interface": {
    "RTCPeerConnection": {
      "Superclass": "EventTarget",
    }
  },
}
```

#### "Ctor"キー
コンストラクターがある場合、解析データに"Ctor"というキーが追加される。
配列それぞれの要素には、各コンストラクターのパラメーター("param"キーもしくはオーバーロードがある場合は"over_load"キー)のあるオブジェクトが出力される。

解析データ出力例
```javascript
{
  "Interface": {
    "RTCSessionDescription": {
      "Ctor": [
        {
          "param": [
            {
              "name": "descriptionInitDict",
              "data_type": [
                {
                  "typeName": "RTCSessionDescriptionInit"
                }
              ]
            }
          ]
        }
      ],
    }
  },
}
```

#### "Attribute"キー、"Member"キー、"Method"キー、"readonly"キー、"static"キー、"defaultValue"キー
DictionaryやInterfaceのメンバーには、AttributeやMethod(Interface)やMember(Dictionary)がある。  
これらメンバーがある場合は、そのDictionaryやInterfaceの配下に"Attribute"キー、"Method"キー、"Member"キーの配下にまとめられそれぞれのメンバー名をキーとして追加される。  
それぞれのメンバー名キー配下には"data_type"キーがある。ただし、Methodメンバー配下の"data_type"キーは戻り値の型を示す。  
staticなメンバーの場合は、そのメンバー配下に"static"というキー(値はtrue)が追加される。  
readonlyのメンバー(Attributeのみ)の場合は、そのメンバー配下に"readonly"というキー(値はtrue)が追加される。  
メンバーにデフォルト値がある場合は、そのメンバーの配下に"defaultValue"というキー(値はデフォルト値)が追加される。  
メンバーに属性がある場合、そのメンバーの配下に"extAttr"キーが追加される。  
Methodメンバーに引数がある場合は、そのメンバーに"param"キーが追加される。  

解析データ出力例
```javascript
{
  "Dictionary": {
    "RTCConfiguration": {
      "Member": {
        "bundlePolicy": {
          // ...
        },
        // ...
      }
    }
  },
  "Interface": {
    "RTCPeerConnection": {
      "Attribute": {
        "localDescription": {
          // ...
        },
        // ...
      },
      "Method": {
        "createOffer": {
          //...
        },
        // ...
      }
    }
  }
}
```
