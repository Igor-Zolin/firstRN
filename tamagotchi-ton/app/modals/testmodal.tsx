import { Link } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@react-navigation/elements';

export default function ModalStore() {
  interface User {
    readonly id: number,
    name: string,
    age: number,
    color: string,
  }
  const user1: User = {
    id: 123,
    name: 'igor',
    age: 18,
    color: 'red',
  }
  // const user2: User = () = {
  //   const [formData, setFormData]= useState({
  //     id: '',
  //     name: '',
  //     age: Number,
  //     color: '',
  //   })
  // }
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [color, setColor] = useState('');
  const handleSubmit = () => {
    console.log('Email:', name);
    console.log('Password:', age);
    console.log('Password:', color);
    // Perform further actions like API calls
  };
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Store Modal</ThemedText>
      <Link href="/test" dismissTo style={styles.link}>
        <ThemedText type="link">
          Go to test page
        </ThemedText>
      </Link>
      <ThemedView>
        <TextInput value={name} placeholder='Name' onChangeText={setName}/>
        <TextInput value={age} placeholder='Age' onChangeText={setAge}/>
        <TextInput value={color} placeholder='Color' onChangeText={setColor}/>
      </ThemedView>
      <Button title='submit' onPress={handleSubmit}/>
      <ThemedText>{ user1.name }</ThemedText>
      <ThemedText>{ user1.age }</ThemedText>
      <ThemedText>{ user1.color }</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});