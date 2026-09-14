---
title: HNUC-2330 Casino-算法Manacher最长回文子串
copyright_type: original
comments: true
date: '2015-08-03 17:22:47'
tags:
- acm
- manacher
- hnuc 2330
- casino
- 最长回文子串
categories:
- ACM
abbrlink: 9c0f5b3f
updated: '2015-08-03 17:22:47'
---

原题：Casino

### 题目描述

Dalia is the assistant director of the fundraising team in the ACPC. She is facing a difficult time this year, there’s a huge lack of sponsors! And now we are facing the danger of not being able to provide the teams with balloons, T-shirts or even name-tags.

Dalia knows it is too late to get a sponsor, actually too late to do anything. But she doesn’t simply give up; she decided that her only hope is to gamble. She will go to a casino where they just invented a new game; she thinks she might have a more promising chance if she plays that game.

The game is very simple, the dealer puts a long string of cards on the table in front of Dalia and she is required to point out palindromes longer than one character (words that are read backward the same as forward) of maximum length (a maximum length palindrome is a palindrome that no other palindrome exists in the string with greater length). So if the maximum length of palindrome in a string is X>1, print all palindromes of length X in the string.

### 输入

Input will start with T number of test cases. Each test case will consist of 1 line that contains a non-empty string S of lower case English letters no longer than 1000 characters.

### 输出

For each test case, print a line containing the case number as shown in the sample then print the palindromes each on a line by itself, in the order of their occurrence in S from right to left.

### 样例输入
    
    
    2
    abcba
    abba

### 样例输出
    
    
    Case #1:
    abcba
    Case #2:
    abba

  


Manacher算法求解即可。  

    
    
    #include <iostream>
    #include <algorithm>
    #include <string>
    #include <cstring>
    using namespace std;
    int len, p[2010];//由于插入字符处理，数组要开至少要开2003=1000*2+2('@','#')+1('\0')
    char str[2010], newstr[2010];
    int k[1001];
    int cas=1;
    
    void change()//插入"#",开头多插入另一个字符"@",防止p[i]越界 
    {  
    	int i;
    	newstr[0] = '@';
    	newstr[1] = '#';
    	for (i = 0; i < len; i++){
    	 newstr[2*i + 2] = str[i];
    	 newstr[2*i + 3] = '#';
    	}
    	newstr[2*len + 2] = '#';
    	newstr[2*len + 3] = '\0';
    	return ;
    }
    
    void Manacher()
    {
    	int i, j,m, id, maxid = 0, ans = 1;
    	len = 2 * len + 2;
    	for (i = 1; i < len; i++){//Manacher算法 
    		if (maxid > i){
    			p[i] = min(p[2*id - i], maxid - i);
    		}
    		else{
    			p[i] = 1;
    		}
    		while (newstr[i+p[i]] == newstr[i-p[i]])
    			p[i]++;
    		if (p[i] + i > maxid){
    			maxid = p[i] + i;
    			id = i;
    		}
    		if (ans < p[i]) {
    			ans = p[i];
    		}
    	}
    	if(ans-1==1){
    		cout <<"Case #"<< cas++ <<":"<<endl;
    		return ;//没有回文子串时直接返回 
    	}
    	for(i=1,m=0;i<len;i++){
    		if(p[i]==ans){
    			k[m]=i;
    			m++;
    		}
    	}//若有一个或多个最长回文子串，记录每一个的中心id 
    	cout <<"Case #"<< cas++ <<":"<<endl;
    	for(int l=m-1;l>=0;l--){
    		for (i = k[l]-p[k[l]]+1, j = 0; i < k[l] + p[k[l]]-1; i++){
    			if (newstr[i] != '#'){
    				str[j] = newstr[i];
    				j++;
    			}
    		}
    	str[j] = '\0';
    	cout << str <<endl;
    	}//题目要求，多个最长回文子串从右至左输出 
    	
    	
    	return ;  
    }  
      
      
    int main(){
    	int T;
    	scanf("%d",&T);
    	while (T--){
    		scanf("%s", &str);
        	len = strlen(str);
            change();
            Manacher();
    	}
    	return 0;
    }
